<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import { listArchivedMusicEntries, restoreArchivedMusicEntry, type MusicArchivedEntry } from '@/api/musicV1'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import MusicArchiveConfirm from '@/components/music/MusicArchiveConfirm.vue'

const authStore = useAuthStore()
const allowed = computed(() => authStore.isAuthenticated && isAdminRole(authStore.user?.role))
const entries = ref<MusicArchivedEntry[]>([])
const filter = ref<'all' | 'album' | 'song'>('all')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const restoreTarget = ref<MusicArchivedEntry | null>(null)
const busy = ref(false)
const actionError = ref('')
let requestId = 0

const filtered = computed(() => entries.value)
const hasPrevious = computed(() => page.value > 1)
const hasNext = computed(() => page.value * pageSize < total.value)

async function load() {
  const current = ++requestId
  if (!allowed.value) { entries.value = []; total.value = 0; return }
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listArchivedMusicEntries(page.value, pageSize, filter.value)
    if (current !== requestId) return
    entries.value = result.data
    total.value = result.meta.total
  } catch {
    if (current === requestId) errorMessage.value = '归档列表加载失败，请重试'
  } finally {
    if (current === requestId) loading.value = false
  }
}

async function movePage(next: number) {
  if (next < 1 || loading.value || (next > page.value && !hasNext.value)) return
  page.value = next
  await load()
}

async function restore(reason: string) {
  const item = restoreTarget.value
  if (!item || busy.value || !allowed.value) return
  busy.value = true
  actionError.value = ''
  try {
    await restoreArchivedMusicEntry(item.entity_type, item.id, reason)
    restoreTarget.value = null
    await load()
  } catch {
    actionError.value = '恢复失败。归档记录可能缺少可安全恢复的快照，或所属专辑仍处于归档状态。'
  } finally {
    busy.value = false
  }
}

watch([allowed, filter], () => { page.value = 1; void load() })
onMounted(() => { void load() })
</script>

<template>
  <main class="a-page-md music-archived-admin">
    <PPageHeader title="归档管理" mb="1.25rem" />
    <PEmpty v-if="!allowed" title="无权访问" description="归档管理仅限管理员使用。" />
    <template v-else>
      <p class="music-archived-admin__hint">已归档条目不会出现在公开搜索、推荐或歌单中。归档保留媒体文件及修订记录。</p>
      <div class="music-archived-admin__toolbar">
        <label for="music-archive-filter">类型筛选</label>
        <select id="music-archive-filter" v-model="filter" data-testid="music-archive-filter">
          <option value="all">全部</option>
          <option value="album">专辑</option>
          <option value="song">歌曲</option>
        </select>
        <PButton variant="secondary" :disabled="loading" @click="load">刷新</PButton>
      </div>
      <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
      <p v-if="loading" role="status">正在加载归档记录…</p>
      <p v-else-if="!filtered.length">当前页没有符合条件的归档记录。</p>
      <ul v-else class="music-archived-admin__list">
        <li v-for="item in filtered" :key="`${item.entity_type}:${item.id}`" class="music-archived-admin__entry">
          <div>
            <strong>{{ item.title || item.id }}</strong>
            <p>{{ item.entity_type === 'album' ? '专辑' : '歌曲' }} · {{ item.archived_at ? new Date(item.archived_at).toLocaleString() : '归档时间未知' }}</p>
            <p v-if="item.reason">原因：{{ item.reason }}</p>
          </div>
          <PButton variant="secondary" :disabled="busy" @click="actionError = ''; restoreTarget = item">恢复</PButton>
        </li>
      </ul>
      <div class="music-archived-admin__pages">
        <PButton variant="secondary" :disabled="!hasPrevious || loading" @click="movePage(page - 1)">上一页</PButton>
        <span>第 {{ page }} 页 · 共 {{ total }} 条</span>
        <PButton variant="secondary" :disabled="!hasNext || loading" @click="movePage(page + 1)">下一页</PButton>
      </div>
    </template>
    <MusicArchiveConfirm :show="Boolean(restoreTarget)" title="恢复归档" :restore="true" :loading="busy" :error="actionError" @confirm="restore" @cancel="restoreTarget = null" />
  </main>
</template>

<style scoped>
.music-archived-admin { padding: 1.25rem 1rem 3rem; }
.music-archived-admin__hint, .music-archived-admin__entry p { color: var(--a-color-muted); font-size: .875rem; }
.music-archived-admin__toolbar, .music-archived-admin__pages { display: flex; align-items: center; gap: .75rem; margin: 1.25rem 0; flex-wrap: wrap; }
.music-archived-admin__toolbar select { padding: .5rem; background: var(--a-color-bg); color: var(--a-color-fg); border: 1px solid var(--a-color-border-soft); }
.music-archived-admin__list { list-style: none; margin: 0; padding: 0; }
.music-archived-admin__entry { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); padding: 1rem 0; }
.music-archived-admin__entry strong { overflow-wrap: anywhere; }
</style>
