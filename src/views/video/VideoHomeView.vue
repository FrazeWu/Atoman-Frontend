<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { Video } from '@/types'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApiUrl } from '@/composables/useApi'

const API_URL = useApiUrl()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const videos = ref<Video[]>([])
const recommendedVideos = ref<Array<{
  id: string
  title: string
  thumbnail_url?: string
  created_at?: string
  view_count?: number
}>>([])
const loading = ref(false)
const recommendationLoading = ref(false)
const sort = ref<'latest' | 'popular'>('latest')
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]
const canPublishVideo = computed(() => siteAccessStore.isFeatureEnabled('video', 'video.publish'))
let fetchVideosSeq = 0

async function fetchVideos() {
  const seq = ++fetchVideosSeq
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/videos?sort=${sort.value}`)
    if (res.ok) {
      const data = await res.json()
      if (seq === fetchVideosSeq) videos.value = data
    }
  } finally {
    if (seq === fetchVideosSeq) loading.value = false
  }
}

async function fetchRecommendedVideos() {
  recommendationLoading.value = true
  try {
    const res = await fetch(`${API_URL}/videos/recommend/items?mode=${recommendationMode.value}&page=1&page_size=8`)
    if (!res.ok) {
      recommendedVideos.value = []
      return
    }
    const data = await res.json()
    recommendedVideos.value = Array.isArray(data.data)
      ? data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail_url: item.image_url,
          created_at: '',
          view_count: 0,
        }))
      : []
  } finally {
    recommendationLoading.value = false
  }
}

onMounted(() => {
  void fetchVideos()
  void fetchRecommendedVideos()
})
watch(sort, fetchVideos)
</script>

<template>
  <div class="vh-wrap">
    <PPageHeader title="视频" accent mb="1.5rem" />

    <section class="vh-recommendations" aria-label="视频推荐">
      <div class="vh-recommendations__header">
        <div>
          <h2 class="vh-recommendations__title">推荐</h2>
          <p class="vh-recommendations__note">按热度、精选、探索切换当前视频推荐。</p>
        </div>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="() => void fetchRecommendedVideos()"
        />
      </div>

      <div v-if="recommendationLoading" class="vh-grid">
        <div v-for="i in 4" :key="i" class="vh-skel">
          <div class="vh-skel-thumb" />
          <div class="vh-skel-info">
            <div class="vh-skel-avatar" />
            <div class="vh-skel-lines">
              <div class="vh-skel-line" style="width:85%" />
              <div class="vh-skel-line" style="width:55%" />
            </div>
          </div>
        </div>
      </div>
      <PEmpty v-else-if="recommendedVideos.length === 0" title="暂无推荐" description="稍后再来看新的视频推荐。" />
      <div v-else class="vh-grid vh-grid--recommendation">
        <PVideoCard v-for="video in recommendedVideos" :key="video.id" :video="video as Video" />
      </div>
    </section>

    <!-- Sticky filter bar (YouTube style) -->
    <div class="vh-bar">
      <div class="vh-bar-inner">
        <button
          v-for="s in [{ v: 'latest', label: '最新上传' }, { v: 'popular', label: '最热播放' }]"
          :key="s.v"
          class="vh-chip"
          :class="{ 'vh-chip--active': sort === s.v }"
          @click="sort = s.v as 'latest' | 'popular'"
        >{{ s.label }}</button>
      </div>
      <div class="vh-bar-action">
        <PButton v-if="authStore.isAuthenticated && canPublishVideo" to="/videos/upload" variant="primary" size="sm">+ 上传</PButton>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="vh-grid">
      <div v-for="i in 12" :key="i" class="vh-skel">
        <div class="vh-skel-thumb" />
        <div class="vh-skel-info">
          <div class="vh-skel-avatar" />
          <div class="vh-skel-lines">
            <div class="vh-skel-line" style="width:85%" />
            <div class="vh-skel-line" style="width:55%" />
            <div class="vh-skel-line" style="width:40%" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="videos.length === 0" class="vh-empty">暂无视频</div>

    <div v-else class="vh-grid">
      <PVideoCard v-for="v in videos" :key="v.id" :video="v" />
    </div>
  </div>
</template>

<style scoped>
.vh-wrap {
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}

.vh-recommendations {
  margin-bottom: 2rem;
}

.vh-recommendations__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.vh-recommendations__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.vh-recommendations__note {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.85rem;
}


/* Sticky filter bar */
.vh-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--a-color-bg);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  margin-bottom: 2rem;
}
.vh-bar-inner {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.vh-bar-inner::-webkit-scrollbar { display: none; }

.vh-chip {
  flex-shrink: 0;
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  border-radius: 0px;
  background: var(--a-color-surface);
  cursor: pointer;
  color: var(--a-color-fg);
  transition: background 0.12s;
  white-space: nowrap;
}
.vh-chip:hover { background: var(--a-color-border); }
.vh-chip--active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

/* Grid */
.vh-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 3rem 1.5rem;
}

@media (min-width: 520px) {
  .vh-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 840px) {
  .vh-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1100px) {
  .vh-grid { grid-template-columns: repeat(4, 1fr); }
}

/* Skeleton card */
.vh-skel { display: flex; flex-direction: column; gap: 0; }
.vh-skel-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--a-color-surface);
  border-radius: 8px;
  animation: pulse 1.4s ease-in-out infinite;
}
.vh-skel-info {
  display: flex;
  gap: 0.65rem;
  padding: 0.6rem 0 0;
}
.vh-skel-avatar {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--a-color-surface);
  animation: pulse 1.4s ease-in-out infinite;
}
.vh-skel-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.1rem;
}
.vh-skel-line {
  height: 0.75rem;
  background: var(--a-color-surface);
  border-radius: 0px;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.vh-empty {
  text-align: center;
  padding: 6rem 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}
</style>
