<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { IconSearch as Search } from '@tabler/icons-vue'
import { listVideos } from '@/api/video'
import type { Video } from '@/types'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'

const query = ref('')
const type = ref<'video' | 'channel' | 'collection'>('video')
const loading = ref(false)
const error = ref('')
const videos = ref<Video[]>([])
const typeOptions = [
  { label: '视频', value: 'video' },
  { label: '频道', value: 'channel' },
  { label: '合集', value: 'collection' },
]
const filteredVideos = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  if (!keyword) return videos.value
  return videos.value.filter((video) => `${video.title} ${video.description || ''}`.toLocaleLowerCase().includes(keyword))
})

async function loadVideos() {
  loading.value = true
  error.value = ''
  try {
    videos.value = await listVideos('latest')
  } catch {
    error.value = '搜索内容加载失败，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadVideos())
watch(type, () => {
  if (type.value !== 'video') videos.value = []
  else if (!videos.value.length) void loadVideos()
})
</script>

<template>
  <div class="a-page-md video-search-view">
    <PPageHeader title="搜索" mb="1.25rem" />
    <div class="video-search__controls">
      <form class="video-search__form" @submit.prevent>
        <PInput v-model="query" type="search" placeholder="搜索视频、频道或合集" autofocus />
        <button type="submit" aria-label="搜索" title="搜索"><Search :size="18" aria-hidden="true" /></button>
      </form>
      <PSegmentedControl v-model="type" :options="typeOptions" />
    </div>

    <p v-if="error" class="video-search__error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="video-search__state">搜索中...</p>
    <PEmpty v-else-if="type !== 'video'" title="搜索尚未开放" description="频道和合集搜索尚未开放。" />
    <PEmpty v-else-if="!filteredVideos.length" title="没有找到视频" description="换一个关键词再试。" />
    <div v-else class="video-search__grid">
      <PVideoCard v-for="video in filteredVideos" :key="video.id" :video="video" />
    </div>
  </div>
</template>

<style scoped>
.video-search-view { min-height: 100%; padding-bottom: 3rem; }
.video-search__controls { display: grid; gap: 0.75rem; margin-bottom: 1.5rem; }
.video-search__form { display: flex; gap: 0.5rem; }
.video-search__form :deep(input) { min-width: 0; }
.video-search__form button { display: inline-flex; width: 46px; flex: 0 0 46px; align-items: center; justify-content: center; border: 1px solid var(--a-color-fg); background: var(--a-color-fg); color: var(--a-color-bg); cursor: pointer; }
.video-search__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 1rem; }
.video-search__state, .video-search__error { color: var(--a-color-muted); }
.video-search__error { color: var(--a-color-danger); }
</style>
