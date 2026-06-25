<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PPress from '@/components/ui/PPress.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { PodcastEpisode } from '@/types'
import { useApiUrl } from '@/composables/useApi'

const router = useRouter()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const canPublishPodcast = computed(() => siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish'))

const API_URL = useApiUrl()
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/podcast/episodes`)
    if (res.ok) episodes.value = await res.json()
  } finally {
    loading.value = false
  }
})

function fmtDuration(sec: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function episodeCover(ep: PodcastEpisode) {
  return ep.episode_cover_url || ep.post?.collections?.[0]?.cover_url || ep.collections?.[0]?.cover_url || ep.channel?.cover_url || ''
}
</script>

<template>
  <div class="a-page-md">
    <PPageHeader title="播客" accent sub="查看当前频道下的播客内容。">
      <template #action>
        <PPress v-if="authStore.isAuthenticated && canPublishPodcast" @click="router.push('/editor')" label="+ 发布节目" />
      </template>
    </PPageHeader>

    <div v-if="loading" class="ph-state">
      <div v-for="i in 3" :key="i" class="a-skeleton" style="height: 10rem; margin-bottom: 1.5rem" />
    </div>
    <div v-else-if="episodes.length === 0" class="ph-state">暂无节目</div>

    <div v-else class="ph-list">
      <PEntry
        v-for="ep in episodes"
        :key="ep.id"
        :title="ep.post?.title || '未命名单集'"
        :summary="ep.post?.summary"
        @click="router.push(`/podcasts/episode/${ep.id}`)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PBadge type="internal" fill>内部</PBadge>
            <PBadge type="podcast">播客</PBadge>
            <img
              v-if="episodeCover(ep)"
              :src="episodeCover(ep)"
              style="width:5rem;height:5rem;object-fit:cover;border:1px solid var(--a-color-line-soft);filter:grayscale(100%);flex-shrink:0;border-radius:4px;margin-top:0.25rem"
            />
          </div>
        </template>

        <template #meta>
          <span v-if="ep.channel" class="a-label a-muted">{{ ep.channel.name }}</span>
          <span v-if="ep.duration_sec" style="font-weight:700;color:var(--a-color-muted-soft)">
            时长: {{ fmtDuration(ep.duration_sec) }}
          </span>
          <span style="color:var(--a-color-muted-soft)">{{ new Date(ep.created_at).toLocaleDateString() }}</span>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<style scoped>
.ph-state { padding: 4rem 0; color: #9ca3af; }
.ph-list { display: flex; flex-direction: column; }
</style>
