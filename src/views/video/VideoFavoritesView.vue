<script setup lang="ts">
import { ref, watch } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useAuthStore } from '@/stores/auth'
import { getVideoResource } from '@/api/video'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import type { Video } from '@/types'

const authStore = useAuthStore()
const activeTab = ref<string>('video')
const videos = ref<Video[]>([])
const channels = ref<Array<{ id: string; name: string; slug?: string }>>([])
const collections = ref<Array<{ id: string; name: string }>>([])
const loading = ref(false)
const error = ref('')
let loadSequence = 0
const tabOptions = [
  { label: '视频', value: 'video' },
  { label: '频道', value: 'channel' },
  { label: '合集', value: 'collection' },
  { label: '稍后看', value: 'watchLater' },
]

async function loadFavorites() {
  const sequence = ++loadSequence
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (activeTab.value === 'video' || activeTab.value === 'watchLater') {
      const items = (await getVideoResource<Array<{ video?: Video }> | null>('/videos/bookmarks', authStore.token ?? undefined)) ?? []
      if (sequence !== loadSequence) return
      videos.value = items.map(item => item.video).filter((video): video is Video => Boolean(video))
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

watch([activeTab, () => authStore.isAuthenticated], () => void loadFavorites(), { immediate: true })
</script>

<template>
  <div class="a-page-xl video-favorites-view">
    <PPageHeader title="视频收藏" mb="1.25rem">
      <template #action>
        <PSegmentedControl v-model="activeTab" :options="tabOptions" />
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="video-favorites-unauth">
      <PEmpty
        title="请登录后查看视频收藏"
        description="登录账号以同步你收藏的视频、频道与稍后看清单。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <p v-if="error" class="video-favorites-error">{{ error }}</p>
      <p v-else-if="loading" class="video-favorites-state">加载中...</p>
      <div v-else-if="activeTab === 'video' || activeTab === 'watchLater'" class="video-favorites-grid">
        <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
        <PEmpty v-if="!videos.length" title="暂无收藏内容" description="浏览视频页面，收藏你感兴趣的视频。" />
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
.video-favorites-links { display: grid; gap: .75rem; }
.video-favorites-links a { color: var(--a-color-fg); text-decoration: none; }
.video-favorites-state, .video-favorites-error { color: var(--a-color-muted); }
.video-favorites-error { color: var(--a-color-danger); }
</style>
