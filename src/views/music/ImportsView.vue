<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  cancelMusicAlbumImportSession,
  deleteMusicAlbumImportFile,
  getMusicAlbum,
  listMusicAlbumImports,
  repairMusicAlbumImport,
  replaceAndUploadMusicAlbumImportFile,
  retryMusicAlbumImportFile,
  type MusicAlbumImport,
} from "@/api/musicV1";
import PButton from "@/components/ui/PButton.vue";
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const imports = ref<MusicAlbumImport[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const selectedId = ref<string | null>(null);
const actionBusy = ref<string | null>(null);
const activeGroup = ref<'draft' | 'processing' | 'failed' | 'completed'>('processing')
const replacementInputs = ref<Record<string, HTMLInputElement | null>>({})
const { resumeMusicCreationFlow } = useMusicDrawers()

const selectedImport = computed(
  () =>
    imports.value.find((item) => item.importId === selectedId.value) ?? null,
);
const importGroups = computed(() => ({
  draft: imports.value.filter(item => ['pending_upload', 'uploading', 'uploaded', 'ready', 'needs_attention'].includes(item.status)),
  processing: imports.value.filter(item => ['queued', 'extracting', 'analyzing', 'transcoding'].includes(item.status)),
  failed: imports.value.filter(item => item.status === 'failed'),
  completed: imports.value.filter(item => ['committed', 'canceled'].includes(item.status)),
}))
const visibleImports = computed(() => importGroups.value[activeGroup.value])
const statusText: Record<string, string> = {
  pending_upload: "等待上传",
  uploading: "上传中",
  uploaded: "等待处理",
  queued: "等待处理",
  extracting: "解压中",
  analyzing: "分析中",
  transcoding: "处理中",
  ready: "等待提交",
  needs_attention: "需要处理",
  failed: "处理失败",
  canceled: "已取消",
  committed: "已完成",
};

async function loadImports() {
  loading.value = true;
  errorMessage.value = "";
  try {
    imports.value = await listMusicAlbumImports();
    if (!selectedId.value && imports.value[0])
      selectedId.value = imports.value[0].importId;
  } catch {
    errorMessage.value = "导入记录加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadImports();
});

async function retryFile(fileId: string) {
  if (!selectedImport.value) return;
  actionBusy.value = fileId;
  try {
    await retryMusicAlbumImportFile(selectedImport.value.importId, fileId);
    await loadImports();
  } catch {
    errorMessage.value = "重试失败";
  } finally {
    actionBusy.value = null;
  }
}

async function deleteFile(fileId: string) {
  if (!selectedImport.value) return;
  actionBusy.value = fileId;
  try {
    await deleteMusicAlbumImportFile(selectedImport.value.importId, fileId);
    await loadImports();
  } catch {
    errorMessage.value = "删除失败";
  } finally {
    actionBusy.value = null;
  }
}

function chooseReplacement(fileId: string) { replacementInputs.value[fileId]?.click() }
async function replaceFile(fileId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!selectedImport.value || !file) return
  actionBusy.value = fileId
  try {
    await replaceAndUploadMusicAlbumImportFile(selectedImport.value.importId, fileId, file)
    await loadImports()
  } catch { errorMessage.value = '替换文件失败' }
  finally { actionBusy.value = null; input.value = '' }
}

async function cancelImport() {
  if (!selectedImport.value) return;
  actionBusy.value = "cancel";
  try {
    await cancelMusicAlbumImportSession(selectedImport.value.importId);
    selectedId.value = null;
    await loadImports();
  } catch {
    errorMessage.value = "取消失败";
  } finally {
    actionBusy.value = null;
  }
}

async function repairImport() {
  if (!selectedImport.value?.targetAlbumId) return
  actionBusy.value = 'repair'
  errorMessage.value = ''
  try {
    const session = await repairMusicAlbumImport(selectedImport.value.importId)
    imports.value = imports.value.map((item) => item.importId === session.importId ? session : item)
    await resumeImport(session)
  } catch {
    errorMessage.value = '无法开始修复'
  } finally {
    actionBusy.value = null
  }
}

async function resumeImport(snapshot: MusicAlbumImport) {
  if (!snapshot.targetAlbumId) {
    resumeMusicCreationFlow(snapshot)
    return
  }
  const album = await getMusicAlbum(snapshot.targetAlbumId)
  resumeMusicCreationFlow(snapshot, (album.artists ?? []).map((artist) => ({
    id: String(artist.id),
    name: artist.name,
  })))
}

async function continueImport() {
  if (!selectedImport.value) return
  errorMessage.value = ''
  try {
    await resumeImport(selectedImport.value)
  } catch {
    errorMessage.value = '无法继续编辑'
  }
}
</script>

<template>
  <div class="music-imports-view">
    <header class="music-imports-view__header">
      <div>
        <h1>导入记录</h1>
        <p>保留最近 7 天的专辑导入</p>
      </div>
      <PButton variant="secondary" :loading="loading" @click="loadImports"
        >刷新</PButton
      >
    </header>

    <p v-if="errorMessage" class="music-imports-view__error">
      {{ errorMessage }}
    </p>
    <p v-else-if="loading && !imports.length" class="music-imports-view__state">
      正在加载
    </p>
    <p v-else-if="!imports.length" class="music-imports-view__state">
      暂无导入记录
    </p>

    <div v-else class="music-imports-view__layout">
      <section class="music-imports-view__list" aria-label="导入记录">
        <div class="music-imports-view__filters" role="tablist" aria-label="导入状态">
          <button v-for="group in [{ key: 'processing', label: '处理中' }, { key: 'draft', label: '草稿' }, { key: 'failed', label: '失败' }, { key: 'completed', label: '已完成' }]" :key="group.key" type="button" :class="{ 'music-imports-view__filter--active': activeGroup === group.key }" :aria-selected="activeGroup === group.key" role="tab" @click="activeGroup = group.key as 'draft' | 'processing' | 'failed' | 'completed'">
            {{ group.label }} {{ importGroups[group.key as keyof typeof importGroups].length }}
          </button>
        </div>
        <p v-if="!visibleImports.length" class="music-imports-view__state">暂无记录</p>
        <button
          v-for="item in visibleImports"
          :key="item.importId"
          type="button"
          :class="[
            'music-imports-view__item',
            {
              'music-imports-view__item--selected':
                item.importId === selectedId,
            },
          ]"
          @click="selectedId = item.importId"
        >
          <strong>{{
            item.derivedAlbumTitle || item.archiveName || "未命名专辑"
          }}</strong>
          <span>{{ statusText[item.status] ?? item.status }}</span>
          <small>{{ item.derivedTracks.length }} 首曲目</small>
        </button>
      </section>

      <section v-if="selectedImport" class="music-imports-view__detail">
        <img
          v-if="selectedImport.coverUrl || selectedImport.derivedCover"
          :src="selectedImport.coverUrl || selectedImport.derivedCover"
          alt="专辑封面"
        />
        <div>
          <h2>
            {{
              selectedImport.derivedAlbumTitle ||
              selectedImport.archiveName ||
              "未命名专辑"
            }}
          </h2>
          <p>
            {{ statusText[selectedImport.status] ?? selectedImport.status }}
          </p>
          <p
            v-if="selectedImport.errorMessage"
            class="music-imports-view__error"
          >
            {{ selectedImport.errorMessage }}
          </p>
          <div
            v-if="!['committed', 'canceled'].includes(selectedImport.status)"
            class="music-imports-view__actions"
          >
            <PButton
              v-if="!['committed', 'canceled'].includes(selectedImport.status)"
              variant="secondary"
              @click="continueImport"
            >继续编辑</PButton>
            <PButton
              variant="secondary"
              :loading="actionBusy === 'cancel'"
              @click="cancelImport"
            >取消导入</PButton
            >
          </div>
          <div v-else-if="selectedImport.status === 'committed' && selectedImport.targetAlbumId" class="music-imports-view__actions">
            <PButton variant="secondary" :loading="actionBusy === 'repair'" @click="repairImport">修复资料</PButton>
          </div>
          <ul
            v-if="selectedImport.files.length"
            class="music-imports-view__files"
          >
            <li v-for="file in selectedImport.files" :key="file.fileId">
              <input :ref="node => replacementInputs[file.fileId] = node as HTMLInputElement | null" class="music-imports-view__file-input" type="file" @change="replaceFile(file.fileId, $event)" />
              <span>{{ file.title || file.fileName }}</span
              ><small v-if="file.errorMessage">{{ file.errorMessage }}</small>
              <PButton
                v-if="
                  file.uploadStatus === 'failed' ||
                  file.processingStatus === 'failed'
                "
                variant="secondary"
                :loading="actionBusy === file.fileId"
                @click="retryFile(file.fileId)"
                >重试</PButton
              >
              <PButton
                v-if="file.uploadStatus === 'failed' || file.processingStatus === 'failed'"
                variant="secondary"
                :disabled="actionBusy === file.fileId"
                @click="chooseReplacement(file.fileId)"
              >替换文件</PButton>
              <PButton
                v-if="file.uploadStatus === 'failed'"
                variant="danger"
                :disabled="actionBusy === file.fileId"
                @click="deleteFile(file.fileId)"
                >删除</PButton
              >
            </li>
          </ul>
          <ol v-if="selectedImport.derivedTracks.length">
            <li
              v-for="track in selectedImport.derivedTracks"
              :key="`${track.audioKey}-${track.title}`"
            >
              {{ track.title }}
            </li>
          </ol>
          <p v-else class="music-imports-view__state">尚未识别到曲目</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.music-imports-view {
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem;
}
.music-imports-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.music-imports-view__header h1,
.music-imports-view__header p,
.music-imports-view__detail h2,
.music-imports-view__detail p {
  margin: 0;
}
.music-imports-view__header p,
.music-imports-view__state {
  color: var(--a-color-muted);
}
.music-imports-view__error {
  margin: 0;
  color: var(--a-color-accent-destructive);
}
.music-imports-view__layout {
  display: grid;
  grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr);
  gap: 1rem;
}
.music-imports-view__list {
  display: grid;
  align-content: start;
  gap: 0.5rem;
}
.music-imports-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.music-imports-view__filters button {
  min-height: 2.25rem;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}
.music-imports-view__filter--active {
  border-bottom-color: var(--a-color-accent) !important;
  color: var(--a-color-text) !important;
}
.music-imports-view__item {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  text-align: left;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-bg);
  color: inherit;
  cursor: pointer;
}
.music-imports-view__item--selected {
  border-color: var(--a-color-accent);
}
.music-imports-view__item span,
.music-imports-view__item small {
  color: var(--a-color-muted);
}
.music-imports-view__detail {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  align-content: start;
  gap: 1rem;
}
.music-imports-view__detail img {
  width: 9rem;
  aspect-ratio: 1;
  object-fit: cover;
}
.music-imports-view__detail ol {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
}
.music-imports-view__actions {
  margin-top: 0.75rem;
}
.music-imports-view__files {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}
.music-imports-view__files li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem;
  border: 1px solid var(--a-color-border-soft);
}
.music-imports-view__files span {
  flex: 1;
  min-width: 12rem;
}
.music-imports-view__files small {
  color: var(--a-color-accent-destructive);
  width: 100%;
}
.music-imports-view__file-input { display: none; }
@media (max-width: 700px) {
  .music-imports-view {
    padding: 1rem;
  }
  .music-imports-view__layout,
  .music-imports-view__detail {
    grid-template-columns: 1fr;
  }
  .music-imports-view__detail img {
    width: min(100%, 14rem);
  }
}
</style>
