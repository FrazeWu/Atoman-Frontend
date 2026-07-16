<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
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
const error = ref('')
const page = ref(0)
const hasMore = ref(false)
const limit = 20
let requestSequence = 0

async function loadEpisodes(append = false) {
  if (loading.value) return

  const sequence = ++requestSequence
  const targetPage = append ? page.value + 1 : 1
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_URL}/podcast/episodes?sort=latest&page=${targetPage}&limit=${limit}`)
    if (sequence !== requestSequence) return
    if (!res.ok) throw new Error(`Failed to load podcast episodes (${res.status})`)

    const rows: unknown = await res.json()
    if (sequence !== requestSequence) return
    if (!Array.isArray(rows)) throw new Error('Invalid podcast episodes response')

    if (append) {
      const existingIDs = new Set(episodes.value.map(episode => episode.id))
      episodes.value = [...episodes.value, ...rows.filter((episode: PodcastEpisode) => !existingIDs.has(episode.id))]
    } else {
      episodes.value = rows
    }
    page.value = targetPage
    hasMore.value = rows.length === limit
  } catch {
    if (sequence !== requestSequence) return
    if (!append) episodes.value = []
    error.value = '加载失败，请重试'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function loadMore() {
  void loadEpisodes(true)
}

onMounted(() => void loadEpisodes())
onUnmounted(() => {
  requestSequence++
  loading.value = false
  error.value = ''
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
  return ep.episode_cover_url || ep.post?.collection?.cover_url || ep.collections?.[0]?.cover_url || ep.channel?.cover_url || ''
}
</script>

<template>
  <div class="a-page-md">
    <PPageHeader title="播客" accent>
      <template #action>
        <PPress v-if="authStore.isAuthenticated && canPublishPodcast" @click="router.push('/podcasts/editor')" label="+ 发布节目" />
      </template>
    </PPageHeader>

    <div v-if="loading && episodes.length === 0" class="ph-state">
      <div v-for="i in 3" :key="i" class="a-skeleton" style="height: 10rem; margin-bottom: 1.5rem" />
    </div>
    <div v-else-if="error && episodes.length === 0" class="ph-state">{{ error }}</div>
    <div v-else-if="episodes.length === 0" class="ph-state">暂无节目</div>

    <div v-else>
      <div class="ph-list">
        <PEntry
          v-for="ep in episodes"
          :key="ep.id"
          :title="ep.post?.title || '未命名单集'"
          :summary="ep.post?.summary"
          @click="router.push(`/podcasts/episode/${ep.id}`)"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
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

      <p v-if="error" class="ph-more ph-error" role="alert">{{ error }}</p>
      <div v-if="hasMore || loading" class="ph-more">
        <PButton label="加载更多" outline :loading="loading" loading-text="加载中..." @click="loadMore" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ph-state { padding: 4rem 0; color: #9ca3af; }
.ph-list { display: flex; flex-direction: column; }
.ph-more { display: flex; justify-content: center; margin-top: 2rem; }
.ph-error { color: var(--a-color-danger); }
</style>
