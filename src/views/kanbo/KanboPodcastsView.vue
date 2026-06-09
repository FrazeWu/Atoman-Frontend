<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AEmpty from '@/components/ui/AEmpty.vue'
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import { useApi } from '@/composables/useApi'
import { modulePathUrl } from '@/router/siteUrls'
import type { PodcastEpisode } from '@/types'

const api = useApi()
const router = useRouter()
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(false)

const loadPodcasts = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ sort: 'latest', limit: '40' })
    const res = await fetch(`${api.podcast.episodes}?${params}`)
    if (!res.ok) return
    const data = await res.json()
    episodes.value = data.data || data.episodes || data || []
  } finally {
    loading.value = false
  }
}

const fmtDuration = (sec: number) => {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

const episodeCover = (episode: PodcastEpisode) => {
  return episode.episode_cover_url
    || episode.post?.collections?.[0]?.cover_url
    || episode.collections?.[0]?.cover_url
    || episode.channel?.cover_url
    || ''
}

onMounted(loadPodcasts)

const episodePath = (episodeId: string) => modulePathUrl('podcast', `/episode/${episodeId}`)
</script>

<template>
  <div class="a-page-xl kanbo-explore-page">
    <APageHeader title="播客" sub="探索本网站发布的全部播客单集。" accent>
      <template #action>
        <div class="kanbo-explore-actions">
          <ABtn to="/create" outline size="sm">返回创作</ABtn>
        </div>
      </template>
    </APageHeader>
    <div v-if="loading" class="a-skeleton kanbo-list-skeleton" />
    <AEmpty v-else-if="episodes.length === 0" text="暂无播客" />
    <div v-else class="kanbo-podcast-list">
      <PaperEntry
        v-for="episode in episodes"
        :key="episode.id"
        :title="episode.post?.title || '未命名单集'"
        :summary="episode.post?.summary"
        @click="router.push(episodePath(episode.id))"
      >
        <template #visual>
          <div class="kanbo-podcast-visual">
            <PaperBadge type="internal" fill>内部</PaperBadge>
            <PaperBadge type="podcast">播客</PaperBadge>
            <img
              v-if="episodeCover(episode)"
              :src="episodeCover(episode)"
              class="kanbo-podcast-cover"
              :alt="episode.post?.title || '播客封面'"
            >
          </div>
        </template>
        <template #meta>
          <span v-if="episode.channel" class="a-label a-muted">{{ episode.channel.name }}</span>
          <span v-if="episode.duration_sec" class="a-muted">时长: {{ fmtDuration(episode.duration_sec) }}</span>
          <span class="a-muted">{{ new Date(episode.created_at).toLocaleDateString() }}</span>
        </template>
      </PaperEntry>
    </div>
  </div>
</template>

<style scoped>
.kanbo-list-skeleton {
  height: 8rem;
}

.kanbo-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.kanbo-podcast-list {
  display: flex;
  flex-direction: column;
}

.kanbo-podcast-visual {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.kanbo-podcast-cover {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 4px;
  margin-top: 0.25rem;
}
</style>
