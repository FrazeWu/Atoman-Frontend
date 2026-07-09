<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { PodcastEpisode } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const api = useApi()
const authStore = useAuthStore()
const router = useRouter()
const episodes = ref<PodcastEpisode[]>([])
const filter = ref('all')
const loading = ref(false)
const message = ref('')

const filters = [
  { label: '全部', value: 'all' },
  { label: '公开', value: 'public' },
  { label: '仅订阅', value: 'followers' },
  { label: '私有', value: 'private' },
  { label: '草稿', value: 'draft' },
]

function queryForFilter() {
  if (filter.value === 'draft') return '?status=draft'
  if (filter.value === 'all') return ''
  return `?visibility=${filter.value}`
}

async function loadEpisodes() {
  loading.value = true
  const res = await fetch(`${api.podcast.creatorEpisodes}${queryForFilter()}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const body = await res.json()
    episodes.value = body.data || []
  }
  loading.value = false
}

async function deleteEpisode(ep: PodcastEpisode) {
  if (!window.confirm('确认删除这个单集？')) return
  const res = await fetch(api.podcast.episode(ep.id), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  message.value = res.ok ? '已删除' : '删除失败'
  await loadEpisodes()
}

async function updateStatus(ep: PodcastEpisode, status: 'draft' | 'published') {
  const res = await fetch(api.podcast.episode(ep.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({
      channel_id: ep.channel_id,
      title: ep.post?.title || '',
      shownotes: ep.post?.content || '',
      audio_url: ep.audio_url,
      episode_cover_url: ep.episode_cover_url,
      season_number: ep.season_number,
      episode_number: ep.episode_number,
      status,
      visibility: ep.post?.visibility || 'public',
      collection_ids: ep.post?.collections?.map(collection => collection.id) || [],
    }),
  })
  message.value = res.ok ? '已更新' : '更新失败'
  await loadEpisodes()
}

async function shareEpisode(ep: PodcastEpisode) {
  await navigator.clipboard?.writeText(`${window.location.origin}/podcasts/episode/${ep.id}`)
  message.value = '已复制链接'
}

onMounted(loadEpisodes)
</script>

<template>
  <div class="pcm">
    <div class="pcm-filters">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        :class="{ active: filter === item.value }"
        @click="filter = item.value; loadEpisodes()"
      >
        {{ item.label }}
      </button>
    </div>
    <p v-if="message" class="pcm-message">{{ message }}</p>
    <div v-if="loading" class="pcm-message">加载中...</div>
    <div v-else class="pcm-list">
      <article v-for="ep in episodes" :key="ep.id" class="pcm-row">
        <div>
          <RouterLink :to="`/podcasts/episode/${ep.id}`" class="pcm-title">{{ ep.post?.title || '未命名单集' }}</RouterLink>
          <div class="pcm-meta">{{ ep.post?.status }} · {{ ep.post?.visibility }}</div>
        </div>
        <div class="pcm-actions">
          <button type="button" @click="router.push(`/podcasts/editor/${ep.id}`)">编辑</button>
          <button type="button" @click="shareEpisode(ep)">分享</button>
          <button type="button" @click="router.push(`/podcasts/editor/${ep.id}`)">重新上传</button>
          <button v-if="ep.post?.status !== 'published'" type="button" @click="updateStatus(ep, 'published')">发布</button>
          <button v-else type="button" @click="updateStatus(ep, 'draft')">下架</button>
          <button type="button" @click="deleteEpisode(ep)">删除</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.pcm { display: grid; gap: 1rem; }
.pcm-filters, .pcm-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.pcm-filters button, .pcm-actions button { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.3rem 0.55rem; font-size: 0.75rem; cursor: pointer; }
.pcm-filters button.active { color: #fff; background: #111827; }
.pcm-message, .pcm-meta { color: #6b7280; font-size: 0.8125rem; }
.pcm-list { display: grid; gap: 0.75rem; }
.pcm-row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 0; }
.pcm-title { color: #111827; font-weight: 700; text-decoration: none; }
.pcm-title:hover { text-decoration: underline; }
</style>
