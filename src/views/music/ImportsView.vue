<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  cancelMusicAlbumImportSession,
  deleteMusicAlbumImportRecord,
  deleteMusicAlbumImportFile,
  getMusicAlbum,
  getMusicArtist,
  listMusicAlbumImports,
  repairMusicAlbumImport,
  replaceAndUploadMusicAlbumImportFile,
  retryMusicAlbumImportFile,
  type MusicAlbumImport,
  type MusicSource,
} from "@/api/musicV1";
import PButton from "@/components/ui/PButton.vue";
import PInput from "@/components/ui/PInput.vue";
import PConfirm from "@/components/ui/PConfirm.vue";
import PaginationBar from "@/components/ui/PaginationBar.vue";
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import {
  musicImportAlbumTitle,
  musicImportGroupForStatus,
  uniqueMusicAlbumImports,
  type MusicImportGroup,
} from '@/utils/musicImportDisplay'
import { normalizeMusicImportSource } from '@/utils/musicImportSource'

const imports = ref<MusicAlbumImport[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const selectedId = ref<string | null>(null);
const actionBusy = ref<string | null>(null);
const pendingConfirmation = ref<{ kind: 'record' | 'file' | 'cancel'; importId: string; fileId?: string } | null>(null)
const page = ref(1)
const importsMeta = ref({ page: 1, page_size: 50, total: 0, has_more: false })
const activeGroup = ref<MusicImportGroup>('in_progress')
const searchQuery = ref('')
const replacementInputs = ref<Record<string, HTMLInputElement | null>>({})
const { resumeMusicCreationFlow } = useMusicDrawers()
const importRequests = useRequestGeneration()
let pollTimer: ReturnType<typeof setTimeout> | null = null

const albumImports = computed(() => uniqueMusicAlbumImports(imports.value))

const importGroups = computed(() => {
  const filtered = albumImports.value.filter((item) => {
    if (!searchQuery.value.trim()) return true
    const q = searchQuery.value.trim().toLowerCase()
    const title = musicImportAlbumTitle(item).toLowerCase()
    const archive = (item.archiveName || '').toLowerCase()
    return title.includes(q) || archive.includes(q)
  })

  return filtered.reduce<Record<MusicImportGroup, MusicAlbumImport[]>>((groups, item) => {
    groups[musicImportGroupForStatus(item.status)].push(item)
    return groups
  }, { in_progress: [], needs_attention: [], published: [], canceled: [] })
})

const visibleImports = computed(() => importGroups.value[activeGroup.value])
const selectedImport = computed(
  () => visibleImports.value.find((item) => item.importId === selectedId.value) ?? null,
)

watch(activeGroup, () => {
  if (!visibleImports.value.some((item) => item.importId === selectedId.value)) {
    selectedId.value = visibleImports.value[0]?.importId ?? null
  }
})

const statusText: Record<string, string> = {
  pending_upload: "等待上传",
  uploading: "上传中",
  uploaded: "等待处理",
  queued: "排队中",
  extracting: "解压中",
  analyzing: "分析中",
  transcoding: "处理中",
  ready: "等待提交",
  needs_attention: "需要处理",
  failed: "处理失败",
  canceled: "已取消",
  committed: "已完成",
};

const trackRecognitionStatuses = new Set([
  'uploading',
  'uploaded',
  'queued',
  'extracting',
  'analyzing',
  'transcoding',
])

const emptyTrackStateText = computed(() =>
  selectedImport.value && trackRecognitionStatuses.has(selectedImport.value.status)
    ? '正在识别曲目'
    : '未识别到曲目',
)

function importErrorText(value: string, status?: string, stage?: string) {
  if (value === 'at least one source is required') return '请填写艺术家和专辑资料来源'
  if (['failed', 'needs_attention'].includes(status || '') && stage !== 'ready') return '处理失败，请重试'
  return value
}

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return ''
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  } catch {
    return ''
  }
}

async function loadImports(silent = false, nextPage = page.value) {
  const request = importRequests.beginRequest()
  if (!silent) loading.value = true;
  errorMessage.value = "";
  try {
    const response = await listMusicAlbumImports({ page: nextPage, page_size: 50 })
    if (!request.isCurrent()) return
    imports.value = uniqueMusicAlbumImports(response.data)
    page.value = nextPage
    importsMeta.value = response.meta
    const selected = albumImports.value.find((item) => item.importId === selectedId.value)
    if (selected) {
      activeGroup.value = musicImportGroupForStatus(selected.status)
    }
    if (!visibleImports.value.some((item) => item.importId === selectedId.value)) {
      selectedId.value = visibleImports.value[0]?.importId ?? null;
    }
  } catch {
    if (request.isCurrent() && !silent) errorMessage.value = "导入记录加载失败";
  } finally {
    if (request.isCurrent()) {
      loading.value = false;
      checkPollState()
    }
  }
}

async function deleteRecord() {
  if (!selectedImport.value) return
  pendingConfirmation.value = { kind: 'record', importId: selectedImport.value.importId }
}

async function confirmPendingAction() {
  const pending = pendingConfirmation.value
  if (!pending || actionBusy.value) return
  pendingConfirmation.value = null
  if (pending.kind === 'record') {
    actionBusy.value = 'delete-record'
    try {
      await deleteMusicAlbumImportRecord(pending.importId)
      selectedId.value = null
      await loadImports(true)
    } catch {
      errorMessage.value = '删除记录失败'
    } finally {
      actionBusy.value = null
    }
    return
  }

  if (pending.kind === 'file' && pending.fileId) {
    actionBusy.value = pending.fileId
    try {
      await deleteMusicAlbumImportFile(pending.importId, pending.fileId)
      await loadImports(true)
    } catch {
      errorMessage.value = '删除失败'
    } finally {
      actionBusy.value = null
    }
    return
  }

  actionBusy.value = 'cancel'
  try {
    await cancelMusicAlbumImportSession(pending.importId)
    selectedId.value = null
    await loadImports(true)
  } catch {
    errorMessage.value = '取消失败'
  } finally {
    actionBusy.value = null
  }
}

function checkPollState() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  const hasProcessing = imports.value.some((item) =>
    ['uploading', 'uploaded', 'queued', 'extracting', 'analyzing', 'transcoding'].includes(item.status)
  )
  if (hasProcessing) {
    pollTimer = setTimeout(() => {
      pollTimer = null
      void loadImports(true)
    }, 3000)
  }
}

onMounted(() => {
  void loadImports();
});

onUnmounted(() => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  importRequests.beginRequest()
})

async function retryFile(fileId: string) {
  if (!selectedImport.value) return;
  const file = selectedImport.value.files.find((item) => item.fileId === fileId)
  if (!file || file.uploadStatus === 'failed') {
    errorMessage.value = '上传失败的文件请先替换后再试'
    return
  }
  actionBusy.value = fileId;
  try {
    await retryMusicAlbumImportFile(selectedImport.value.importId, fileId);
    await loadImports(true);
  } catch {
    errorMessage.value = "重试失败";
  } finally {
    actionBusy.value = null;
  }
}

async function retryAllFailedFiles() {
  if (!selectedImport.value) return
  const importId = selectedImport.value.importId
  const files = [...selectedImport.value.files]
  const retryFiles = files.filter(f => f.processingStatus === 'failed')
  if (!retryFiles.length) {
    errorMessage.value = '没有可重试的失败文件'
    return
  }

  actionBusy.value = 'retry-all'
  try {
    for (const f of retryFiles) {
      await retryMusicAlbumImportFile(importId, f.fileId)
    }
    await loadImports(true)
  } catch {
    errorMessage.value = '一键重试部分失败'
  } finally {
    actionBusy.value = null
  }
}

async function deleteFile(fileId: string) {
  if (!selectedImport.value) return;
  pendingConfirmation.value = { kind: 'file', importId: selectedImport.value.importId, fileId }
}

function chooseReplacement(fileId: string) { replacementInputs.value[fileId]?.click() }
async function replaceFile(fileId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!selectedImport.value || !file) return
  actionBusy.value = fileId
  try {
    await replaceAndUploadMusicAlbumImportFile(selectedImport.value.importId, fileId, file)
    await loadImports(true)
  } catch { errorMessage.value = '替换文件失败' }
  finally { actionBusy.value = null; input.value = '' }
}

async function cancelImport() {
  if (!selectedImport.value) return;
  pendingConfirmation.value = { kind: 'cancel', importId: selectedImport.value.importId }
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

function sourceValue(sources?: MusicSource[]) {
  const source = sources?.find((item) => item.url?.trim() || item.title?.trim())
  return normalizeMusicImportSource(source?.url?.trim() || source?.title?.trim())
}

async function resumeImport(snapshot: MusicAlbumImport) {
  let artistSource = ''
  if (snapshot.artistId?.trim()) {
    try {
      artistSource = sourceValue((await getMusicArtist(snapshot.artistId)).sources)
    } catch {
      // The import can still be resumed and the source can be entered manually.
    }
  }

  if (!snapshot.targetAlbumId) {
    resumeMusicCreationFlow(snapshot, [], artistSource)
    return
  }
  const album = await getMusicAlbum(snapshot.targetAlbumId)
  const albumArtists = await Promise.all((album.artists ?? []).map(async (artist) => {
    let source = ''
    try {
      source = sourceValue((await getMusicArtist(String(artist.id))).sources)
    } catch {
      // The artist can still be selected without a prefilled source.
    }
    return {
      id: String(artist.id),
      name: artist.name,
      source,
    }
  }))
  const resolvedArtistSource = artistSource || albumArtists.find((artist) => artist.id === snapshot.artistId)?.source || ''
  resumeMusicCreationFlow(snapshot, albumArtists, resolvedArtistSource)
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
        <h1>导入中心</h1>
        <p>查看上传、处理和发布状态</p>
      </div>
      <PButton variant="secondary" :loading="loading" @click="() => loadImports(false)"
        >刷新</PButton
      >
    </header>

    <p v-if="errorMessage" class="music-imports-view__error">
      {{ errorMessage }}
    </p>
    <p v-else-if="loading && !imports.length" class="music-imports-view__state">
      正在加载
    </p>
    <p v-else-if="!albumImports.length" class="music-imports-view__state">
      暂无导入记录
    </p>

    <div v-else class="music-imports-view__layout">
      <section class="music-imports-view__list" aria-label="导入记录">
        <div class="music-imports-view__search">
          <PInput v-model="searchQuery" placeholder="搜索标题或文件名…" />
        </div>
        <div class="music-imports-view__filters" role="tablist" aria-label="导入状态">
          <button v-for="group in [{ key: 'in_progress', label: '进行中' }, { key: 'needs_attention', label: '需处理' }, { key: 'published', label: '已发布' }, { key: 'canceled', label: '已取消' }]" :key="group.key" type="button" :class="{ 'music-imports-view__filter--active': activeGroup === group.key }" :aria-selected="activeGroup === group.key" role="tab" @click="activeGroup = group.key as 'in_progress' | 'needs_attention' | 'published' | 'canceled'">
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
          <div class="item-header">
            <strong>{{ musicImportAlbumTitle(item) }}</strong>
            <span class="status-badge" :data-status="item.status">{{ statusText[item.status] ?? item.status }}</span>
          </div>
          <div class="item-sub">
            <small v-if="item.derivedTracks.length">{{ item.derivedTracks.length }} 首曲目</small>
            <small v-if="item.archiveName" class="archive-name">{{ item.archiveName }}</small>
            <small v-if="formatDate(item.lastSyncedAt)" class="sync-time">{{ formatDate(item.lastSyncedAt) }}</small>
          </div>
        </button>
      </section>

      <section v-if="selectedImport" class="music-imports-view__detail">
        <div class="cover-wrapper">
          <img
            v-if="selectedImport.coverUrl || selectedImport.derivedCover"
            :src="selectedImport.coverUrl || selectedImport.derivedCover"
            alt="专辑封面"
          />
          <div v-else class="no-cover">无封面</div>
        </div>
        <div class="detail-main">
          <h2>{{ musicImportAlbumTitle(selectedImport) }}</h2>
          <div class="detail-meta">
            <span class="status-badge" :data-status="selectedImport.status">{{ statusText[selectedImport.status] ?? selectedImport.status }}</span>
            <span v-if="selectedImport.archiveName" class="meta-archive">文件: {{ selectedImport.archiveName }}</span>
            <span v-if="formatDate(selectedImport.lastSyncedAt)" class="meta-time">更新于 {{ formatDate(selectedImport.lastSyncedAt) }}</span>
          </div>

          <p v-if="['pending_upload', 'uploading'].includes(selectedImport.status)" class="status-hint">
            上传尚未完成，可继续填写资料。
          </p>
          <p v-else-if="selectedImport.status === 'needs_attention' && selectedImport.stage === 'ready'" class="status-hint">
            媒体处理已完成，请补充艺术家和专辑资料后提交。
          </p>
          <p v-else-if="selectedImport.status === 'needs_attention'" class="status-hint">
            请替换或重试未完成的源文件恢复处理。
          </p>

          <p
            v-if="selectedImport.errorMessage"
            class="music-imports-view__error"
          >
            {{ importErrorText(selectedImport.errorMessage, selectedImport.status, selectedImport.stage) }}
          </p>

          <div class="music-imports-view__actions">
            <PButton
              v-if="!['committed', 'canceled'].includes(selectedImport.status)"
              variant="primary"
              @click="continueImport"
            >
              {{ selectedImport.status === 'needs_attention' ? '处理问题' : '继续导入' }}
            </PButton>

            <PButton
              v-if="selectedImport.files.some(f => f.processingStatus === 'failed')"
              variant="secondary"
              :loading="actionBusy === 'retry-all'"
              @click="retryAllFailedFiles"
            >一键重试失败文件</PButton>

            <PButton
              v-if="!['committed', 'canceled'].includes(selectedImport.status)"
              variant="secondary"
              :loading="actionBusy === 'cancel'"
              @click="cancelImport"
            >取消导入</PButton>

            <PButton
              v-else-if="selectedImport.status === 'committed' && selectedImport.targetAlbumId"
              variant="secondary"
              :loading="actionBusy === 'repair'"
              @click="repairImport"
            >修复资料</PButton>
            <PButton
              v-if="['committed', 'canceled'].includes(selectedImport.status)"
              variant="danger"
              :loading="actionBusy === 'delete-record'"
              @click="deleteRecord"
            >删除记录</PButton>
          </div>

          <ul
            v-if="selectedImport.files.length"
            class="music-imports-view__files"
          >
            <li v-for="file in selectedImport.files" :key="file.fileId">
              <input :ref="node => replacementInputs[file.fileId] = node as HTMLInputElement | null" class="music-imports-view__file-input" type="file" @change="replaceFile(file.fileId, $event)" />
              <div class="file-name-cell">
                <span class="file-title">{{ file.title || file.fileName }}</span>
                <small v-if="file.errorMessage" class="file-err">{{ file.errorMessage }}</small>
              </div>
              <div class="file-actions">
                <PButton
                  v-if="file.processingStatus === 'failed'"
                  variant="secondary"
                  :loading="actionBusy === file.fileId"
                  @click="retryFile(file.fileId)"
                  >重试</PButton
                >
                <PButton
                  v-if="file.uploadStatus === 'failed' || file.processingStatus === 'failed' || (selectedImport.status === 'needs_attention' && file.uploadStatus !== 'uploaded')"
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
              </div>
            </li>
          </ul>

          <div v-if="selectedImport.derivedTracks.length" class="detail-tracks-section">
            <h3>可辨识曲目列表 ({{ selectedImport.derivedTracks.length }})</h3>
            <ol class="detail-tracks-list">
              <li
                v-for="track in selectedImport.derivedTracks"
                :key="`${track.audioKey}-${track.title}`"
              >
                {{ track.title }}
              </li>
            </ol>
          </div>
          <p v-else class="music-imports-view__state">{{ emptyTrackStateText }}</p>
        </div>
      </section>
    </div>
    <PaginationBar
      :meta="importsMeta"
      :loading="loading"
      @change="(nextPage) => loadImports(false, nextPage)"
    />
  </div>
  <PConfirm
    :show="pendingConfirmation !== null"
    title="确认导入操作"
    :message="pendingConfirmation?.kind === 'record'
      ? '确认删除这条导入记录？已发布的专辑和歌曲不会被删除。'
      : pendingConfirmation?.kind === 'file'
        ? '确认移除这个文件？'
        : '确认取消这个导入任务？'"
    :confirm-text="pendingConfirmation?.kind === 'cancel' ? '取消任务' : '确认删除'"
    danger
    :loading="actionBusy !== null"
    @confirm="confirmPendingAction"
    @cancel="pendingConfirmation = null"
  />
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
  grid-template-columns: minmax(15rem, 24rem) minmax(0, 1fr);
  gap: 1.25rem;
}
.music-imports-view__list {
  display: grid;
  align-content: start;
  gap: 0.6rem;
}
.music-imports-view__search {
  margin-bottom: 0.25rem;
}
.music-imports-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.music-imports-view__filters button {
  min-height: 2.25rem;
  padding: 0.25rem 0.6rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}
.music-imports-view__filter--active {
  border-bottom-color: var(--a-color-accent) !important;
  color: var(--a-color-text) !important;
  font-weight: 600 !important;
}
.music-imports-view__item {
  display: grid;
  gap: 0.4rem;
  padding: 0.85rem;
  text-align: left;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-bg);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.music-imports-view__item:hover {
  background-color: var(--a-color-surface-muted);
}
.music-imports-view__item--selected {
  border-color: var(--a-color-accent);
  background-color: var(--a-color-surface-muted);
}
.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.item-header strong {
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  border: 1px solid var(--a-color-border-soft);
  white-space: nowrap;
  flex-shrink: 0;
}
.status-badge[data-status="ready"] {
  background: color-mix(in srgb, #22c55e 12%, transparent);
  color: #16a34a;
  border-color: color-mix(in srgb, #22c55e 25%, transparent);
}
.status-badge[data-status="failed"] {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #dc2626;
  border-color: color-mix(in srgb, #ef4444 25%, transparent);
}
.status-badge[data-status="extracting"],
.status-badge[data-status="analyzing"],
.status-badge[data-status="transcoding"] {
  background: color-mix(in srgb, #3b82f6 12%, transparent);
  color: #2563eb;
  border-color: color-mix(in srgb, #3b82f6 25%, transparent);
}
.item-sub {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  flex-wrap: wrap;
}
.archive-name {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sync-time {
  margin-left: auto;
}
.music-imports-view__detail {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  align-content: start;
  gap: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-bg);
}
.cover-wrapper {
  width: 9rem;
  aspect-ratio: 1;
}
.cover-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}
.no-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.8rem;
  border-radius: 4px;
}
.detail-main {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}
.detail-main h2 {
  font-size: 1.15rem;
  font-weight: 600;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--a-color-muted);
  flex-wrap: wrap;
}
.status-hint {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  font-size: 0.82rem;
  color: var(--a-color-text-secondary);
}
.status-hint--ready {
  background: color-mix(in srgb, #22c55e 10%, transparent);
  border-color: color-mix(in srgb, #22c55e 25%, transparent);
  color: #16a34a;
}
.music-imports-view__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.music-imports-view__files {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.music-imports-view__files li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface-muted);
}
.file-name-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.file-title {
  font-size: 0.85rem;
  word-break: break-all;
}
.file-err {
  color: var(--a-color-accent-destructive);
  font-size: 0.75rem;
  margin-top: 0.15rem;
}
.file-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.file-actions button {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem !important;
}
.music-imports-view__file-input { display: none; }
.detail-tracks-section {
  margin-top: 0.5rem;
}
.detail-tracks-section h3 {
  font-size: 0.85rem;
  color: var(--a-color-muted);
  margin: 0 0 0.5rem;
}
.detail-tracks-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.88rem;
  display: grid;
  gap: 0.35rem;
}

@media (max-width: 768px) {
  .music-imports-view {
    padding: 1rem;
  }
  .music-imports-view__layout,
  .music-imports-view__detail {
    grid-template-columns: 1fr;
  }
  .cover-wrapper {
    width: min(100%, 10rem);
  }
}
</style>
