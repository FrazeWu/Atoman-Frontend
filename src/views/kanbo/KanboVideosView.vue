<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
import VideoCard from '@/components/shared/VideoCard.vue'
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

const videoPath = (videoId: string) => modulePathUrl('video', `/watch/${videoId}`)
</script>

<template>
  <div class="a-page-xl kanbo-explore-page">
    <APageHeader title="视频" sub="探索本网站发布的全部视频。" accent>
      <template #action>
        <div class="kanbo-explore-actions">
          <PaperTab label="最新" :active="sort === 'latest'" @click="changeSort('latest')" />
          <PaperTab label="热门" :active="sort === 'popular'" @click="changeSort('popular')" />
          <ABtn to="/create" outline size="sm">返回创作</ABtn>
        </div>
      </template>
    </APageHeader>
    <div v-if="loading" class="a-skeleton kanbo-list-skeleton" />
    <AEmpty v-else-if="videos.length === 0" text="暂无视频" />
    <div v-else class="kanbo-video-grid">
      <VideoCard v-for="video in videos" :key="video.id" :video="video" :to="videoPath(video.id)" />
    </div>
  </div>
</template>

<style scoped>
.kanbo-list-skeleton {
  height: 8rem;
}

.kanbo-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.kanbo-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
