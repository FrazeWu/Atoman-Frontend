<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import { useAuthStore } from '@/stores/auth'
import { getVideoResource } from '@/api/video'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useVideoBookmarks, type VideoBookmarkSort, type VideoBookmarkState } from '@/composables/useVideoBookmarks'
import type { Video } from '@/types'

const authStore = useAuthStore()
const activeTab = ref<string>('video')
const videos = ref<Video[]>([])
const bookmarks = useVideoBookmarks()
const queueState = ref<VideoBookmarkState>('active')
const queueSort = ref<VideoBookmarkSort>('latest')
const selectedVideoIds = ref<string[]>([])
const removingSelected = ref(false)
const channels = ref<Array<{ id: string; name: string; slug?: string }>>([])
const collections = ref<Array<{ id: string; name: string }>>([])
const loading = ref(false)
const error = ref('')
let loadSequence = 0
const tabOptions = [
  { label: '收藏频道', value: 'channel' },
  { label: '收藏合集', value: 'collection' },
  { label: '稍后看', value: 'watchLater' },
]
const queueVideos = computed(() => Object.values(bookmarks.records.value)
  .map(item => item.video)
  .filter((video): video is Video => Boolean(video)))
const allQueueSelected = computed(() => queueVideos.value.length > 0 && queueVideos.value.every(video => selectedVideoIds.value.includes(video.id)))

async function loadFavorites() {
  const sequence = ++loadSequence
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (activeTab.value === 'watchLater') {
      await bookmarks.load(queueState.value, queueSort.value)
      if (sequence !== loadSequence) return
      selectedVideoIds.value = []
    } else if (activeTab.value === 'channel') {
      const items = (await getVideoResource<Array<{ channel?: { id: string; name: string; slug?: string } }> | null>('/videos/channel-bookmarks', authStore.token ?? undefined)) ?? []
      if (sequence !== loadSequence) return
      channels.value = items.map(item => item.channel).filter((channel): channel is { id: string; name: string; slug?: string } => Boolean(channel))
    } else {
      const items = (await getVideoResource<Array<{ collection?: { id: string; name: string } }> | null>('/videos/collection-bookmarks', authStore.token ?? undefined)) ?? []
      if (sequence !== loadSequence) return
      collections.value = items.map(item => item.collection).filter((collection): collection is { id: string; name: string } => Boolean(collection))
    }
  } catch {
    if (sequence === loadSequence) error.value = '收藏加载失败，请重试'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function toggleQueueSelection(videoID: string) {
  selectedVideoIds.value = selectedVideoIds.value.includes(videoID)
    ? selectedVideoIds.value.filter(id => id !== videoID)
    : [...selectedVideoIds.value, videoID]
}

function toggleAllQueueSelection() {
  selectedVideoIds.value = allQueueSelected.value ? [] : queueVideos.value.map(video => video.id)
}

async function removeSelected() {
  removingSelected.value = true
  error.value = ''
  try {
    await bookmarks.removeMany(selectedVideoIds.value)
    selectedVideoIds.value = []
  } catch {
    error.value = '移除失败，请重试'
  } finally {
    removingSelected.value = false
  }
}

watch([activeTab, () => authStore.isAuthenticated, queueState, queueSort], () => void loadFavorites(), { immediate: true })
</script>

<template>
  <div class="a-page-xl video-favorites-view">
    <PPageHeader title="视频资料库" mb="1.25rem">
      <template #action>
        <PSegmentedControl v-model="activeTab" :options="tabOptions" />
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="video-favorites-unauth">
      <PEmpty
        title="请登录后查看视频收藏"
        description="登录账号以同步稍后看、收藏频道与收藏合集。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <p v-if="error" class="video-favorites-error">{{ error }}</p>
      <p v-else-if="loading" class="video-favorites-state">加载中...</p>
      <template v-else-if="activeTab === 'watchLater'">
        <div class="video-queue-toolbar">
          <PSegmentedControl v-model="queueState" :options="[{ label: '待观看', value: 'active' }, { label: '已看完', value: 'completed' }]" />
          <label class="video-queue-sort">排序
            <select v-model="queueSort">
              <option value="latest">最近加入</option>
              <option value="popular">热度优先</option>
            </select>
          </label>
          <label v-if="queueVideos.length" class="video-queue-select-all">
            <input type="checkbox" :checked="allQueueSelected" @change="toggleAllQueueSelection" /> 全选
          </label>
          <PButton v-if="selectedVideoIds.length" variant="danger" size="sm" :loading="removingSelected" @click="removeSelected">移除所选 ({{ selectedVideoIds.length }})</PButton>
        </div>
        <div class="video-favorites-grid">
          <article v-for="video in queueVideos" :key="video.id" class="video-queue-item">
            <label class="video-queue-select" :aria-label="`选择 ${video.title}`">
              <input type="checkbox" :checked="selectedVideoIds.includes(video.id)" @change="toggleQueueSelection(video.id)" />
            </label>
            <PVideoCard :video="video" />
          </article>
          <PEmpty v-if="!queueVideos.length" :title="queueState === 'completed' ? '暂无已看完视频' : '稍后看为空'" description="在视频卡片上加入稍后看，方便继续浏览。" />
        </div>
      </template>
      </div>
      <div v-else-if="activeTab === 'channel'" class="video-favorites-links">
        <RouterLink v-for="channel in channels" :key="channel.id" :to="`/channel/${channel.slug || channel.id}`">{{ channel.name }}</RouterLink>
        <PEmpty v-if="!channels.length" title="暂无收藏频道" />
      </div>
      <div v-else class="video-favorites-links">
        <RouterLink v-for="collection in collections" :key="collection.id" :to="`/videos/collections/${collection.id}`">{{ collection.name }}</RouterLink>
        <PEmpty v-if="!collections.length" title="暂无收藏合集" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-favorites-view {
  min-height: 100%;
  padding-bottom: 3rem;
}
.video-favorites-unauth {
  padding: 3rem 0;
}
.video-favorites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 1.5rem; }
.video-queue-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin-bottom: 1rem; }
.video-queue-sort, .video-queue-select-all { display: inline-flex; align-items: center; gap: .375rem; color: var(--a-color-muted); font-size: .875rem; }
.video-queue-sort select { min-height: 2rem; border: 1px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-fg); }
.video-queue-item { position: relative; min-width: 0; }
.video-queue-select { position: absolute; z-index: 1; top: .5rem; left: .5rem; display: grid; width: 1.75rem; height: 1.75rem; place-items: center; background: var(--a-color-surface); border: 1px solid var(--a-color-border); }
.video-queue-select input, .video-queue-select-all input { accent-color: var(--a-color-primary); }
.video-favorites-links { display: grid; gap: .75rem; }
.video-favorites-links a { color: var(--a-color-fg); text-decoration: none; }
.video-favorites-state, .video-favorites-error { color: var(--a-color-muted); }
.video-favorites-error { color: var(--a-color-danger); }
@media (max-width: 640px) { .video-queue-toolbar { align-items: stretch; } .video-queue-sort { justify-content: space-between; } }
</style>
