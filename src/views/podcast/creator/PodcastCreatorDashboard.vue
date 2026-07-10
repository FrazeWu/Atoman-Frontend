<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { PodcastEpisode } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type DashboardData = {
  total_episodes: number
  published_episodes: number
  draft_episodes: number
  total_comments: number
  total_bookmarks: number
  total_listen_later: number
  recent_episodes: PodcastEpisode[]
  issues: string[]
}

const api = useApi()
const authStore = useAuthStore()
const router = useRouter()
const data = ref<DashboardData | null>(null)
const loading = ref(true)

const issueLabels: Record<string, string> = {
  draft: '有草稿',
  missing_cover: '缺少封面',
  missing_collection: '未加入合集',
  missing_audio: '缺少音频',
}

onMounted(async () => {
  const res = await fetch(api.podcast.creatorDashboard, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const body = await res.json()
    data.value = body.data
  }
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="pc-state">加载中...</div>
  <div v-else-if="data" class="pc-stack">
    <div class="pc-cards">
      <div class="pc-card"><strong>{{ data.total_episodes }}</strong><span>单集</span></div>
      <div class="pc-card"><strong>{{ data.published_episodes }}</strong><span>已发布</span></div>
      <div class="pc-card"><strong>{{ data.draft_episodes }}</strong><span>草稿</span></div>
      <div class="pc-card"><strong>{{ data.total_comments }}</strong><span>评论</span></div>
      <div class="pc-card"><strong>{{ data.total_bookmarks }}</strong><span>收藏</span></div>
      <div class="pc-card"><strong>{{ data.total_listen_later }}</strong><span>稍后听</span></div>
    </div>

    <section>
      <div class="pc-section-head">
        <h2>最近单集</h2>
        <button type="button" @click="router.push('/podcasts/editor')">发布单集</button>
      </div>
      <div class="pc-list">
        <RouterLink
          v-for="ep in data.recent_episodes"
          :key="ep.id"
          :to="`/podcasts/episode/${ep.id}`"
          class="pc-row"
        >
          {{ ep.post?.title || '未命名单集' }}
        </RouterLink>
      </div>
    </section>

    <section>
      <h2>待处理</h2>
      <div v-if="data.issues.length" class="pc-issues">
        <span v-for="issue in data.issues" :key="issue">{{ issueLabels[issue] || issue }}</span>
      </div>
      <p v-else class="pc-state">暂无事项</p>
    </section>
  </div>
</template>

<style scoped>
.pc-stack { display: grid; gap: 1.5rem; }
.pc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.75rem; }
.pc-card { display: grid; gap: 0.25rem; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; }
.pc-card strong { font-size: 1.5rem; }
.pc-card span, .pc-state { color: #6b7280; font-size: 0.875rem; }
.pc-section-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.pc-section-head h2, section h2 { margin: 0 0 0.75rem; font-size: 1rem; }
.pc-section-head button { border: 1px solid #111827; border-radius: 6px; background: #111827; color: #fff; padding: 0.35rem 0.65rem; cursor: pointer; }
.pc-list { display: grid; gap: 0.5rem; }
.pc-row { border-bottom: 1px solid #e5e7eb; padding: 0.65rem 0; color: #111827; text-decoration: none; }
.pc-row:hover { text-decoration: underline; }
.pc-issues { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.pc-issues span { border: 1px solid #d1d5db; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.8125rem; }
</style>
