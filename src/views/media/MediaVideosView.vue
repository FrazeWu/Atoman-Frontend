<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApi } from '@/composables/useApi'
import { modulePathUrl } from '@/router/siteUrls'
import type { Video } from '@/types'

const api = useApi()
const videos = ref<Video[]>([])
const loading = ref(false)
const sort = ref<'latest' | 'popular'>('latest')

const loadVideos = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ sort: sort.value, limit: '40' })
    const res = await fetch(`${api.videos.list}?${params}`)
    if (!res.ok) return
    videos.value = await res.json()
  } finally {
    loading.value = false
  }
}

const changeSort = (nextSort: 'latest' | 'popular') => {
  sort.value = nextSort
  void loadVideos()
}

onMounted(loadVideos)

const videoPath = (videoId: string) => modulePathUrl('media', `/videos/watch/${videoId}`)
</script>

<template>
  <div class="a-page-xl media-explore-page">
    <PPageHeader title="视频" accent>
      <template #action>
        <div class="media-explore-actions">
          <PSegmentedControl
            v-model="sort"
            :options="[
              { label: '最新', value: 'latest' },
              { label: '热门', value: 'popular' }
            ]"
            @change="changeSort"
          />
          <PButton :to="modulePathUrl('media', '/create')" outline size="sm">返回创作</PButton>
        </div>
      </template>
    </PPageHeader>
    <div v-if="loading" class="a-skeleton media-list-skeleton" />
    <PEmpty v-else-if="videos.length === 0" text="暂无视频" />
    <div v-else class="media-video-grid">
      <PVideoCard v-for="video in videos" :key="video.id" :video="video" :to="videoPath(video.id)" />
    </div>
  </div>
</template>

<style scoped>
.media-list-skeleton {
  height: 8rem;
}

.media-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.media-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
