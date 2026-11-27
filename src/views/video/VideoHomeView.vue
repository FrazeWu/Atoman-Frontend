<script setup lang="ts">
import { createVideoRecommendationFeedback, getVideoRecommendations, listVideoPage, type VideoRecommendationFeedbackScope } from '@/api/video'
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import type { Video } from '@/types'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import { MoreHorizontal as More } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { publicVideoCollections } from '@/utils/publicVideoCollections'

const videos = ref<Video[]>([])
const publicCollections = computed(() => publicVideoCollections(videos.value))
const router = useRouter()
const authStore = useAuthStore()
const videoSearchTypes = ['video'] as const
const videoSearchQuery = ref('')
const recommendedVideos = ref<Video[]>([])
const loading = ref(false)
const videoError = ref('')
const recommendationLoading = ref(false)
const recommendationError = ref('')
const recommendationFeedbackError = ref('')
const sort = ref<'latest' | 'popular'>('latest')
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const recommendationMeta = ref({ page: 1, page_size: 8, total: 0, has_more: false })
const videoMeta = ref({ page: 1, page_size: 12, total: 0, has_more: false })
const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]
type RecommendedVideoPayload = {
  id: string
  title: string
  image_url?: string
  target_path?: string
  video?: Video
}
let fetchVideosSeq = 0
let fetchRecommendationsSeq = 0

async function fetchVideos(page = videoMeta.value.page) {
  const seq = ++fetchVideosSeq
  loading.value = true
  videoError.value = ''
  try {
    const data = await listVideoPage(sort.value, page, videoMeta.value.page_size, authStore.token ?? undefined)
    if (seq === fetchVideosSeq) {
      videos.value = data.data
      videoMeta.value = data.meta
    }
  } catch {
    if (seq === fetchVideosSeq) {
      videos.value = []
      videoError.value = '视频加载失败'
    }
  } finally {
    if (seq === fetchVideosSeq) loading.value = false
  }
}

function changeVideoPage(page: number) {
  if (page < 1 || page === videoMeta.value.page || loading.value) return
  void fetchVideos(page)
}

async function fetchRecommendedVideos() {
  const seq = ++fetchRecommendationsSeq
  recommendationLoading.value = true
  recommendationError.value = ''
  try {
    const data = await getVideoRecommendations<RecommendedVideoPayload>(
      recommendationMode.value,
      recommendationMeta.value.page,
      recommendationMeta.value.page_size,
      authStore.token ?? undefined,
    )
    if (seq !== fetchRecommendationsSeq) return
    recommendedVideos.value = data.data.flatMap(item => item.video ? [item.video] : [])
    recommendationMeta.value = data.meta
  } catch {
    if (seq === fetchRecommendationsSeq) {
      recommendedVideos.value = []
      recommendationError.value = '推荐加载失败'
    }
  } finally {
    if (seq === fetchRecommendationsSeq) recommendationLoading.value = false
  }
}

function changeRecommendationPage(page: number) {
  if (page < 1 || page === recommendationMeta.value.page || recommendationLoading.value) return
  recommendationMeta.value = { ...recommendationMeta.value, page }
  void fetchRecommendedVideos()
}

function changeRecommendationMode() {
  recommendationMeta.value = { ...recommendationMeta.value, page: 1 }
  void fetchRecommendedVideos()
}

async function submitRecommendationFeedback(scope: VideoRecommendationFeedbackScope, targetID: string, videoID: string, close: () => void) {
  if (!authStore.isAuthenticated) { await router.push('/login'); return }
  recommendationFeedbackError.value = ''
  try {
    const response = await createVideoRecommendationFeedback(scope, targetID, authStore.token ?? undefined)
    if (!response.ok) throw new Error('推荐反馈提交失败')
    recommendedVideos.value = recommendedVideos.value.filter(video => video.id !== videoID)
    close()
  } catch {
    recommendationFeedbackError.value = '推荐反馈提交失败，请稍后重试'
  }
}

onMounted(() => {
  void fetchVideos(1)
  void fetchRecommendedVideos()
})
watch(sort, () => {
  videoMeta.value = { ...videoMeta.value, page: 1 }
  void fetchVideos(1)
})
</script>

<template>
  <div class="vh-wrap">
    <PPageHeader title="视频" mb="1.25rem">
      <template #action>
        <div class="vh-search">
          <PUnifiedSearchBar
            v-model="videoSearchQuery"
            module="video"
            :types="['video']"
            size="sm"
            placeholder="搜索视频"
            action-button-text="搜索"
            input-test-id="video-module-search-input"
            dropdown-test-id="video-module-search-dropdown"
          />
        </div>
      </template>
    </PPageHeader>

    <ContentContinueSection module="video" />

    <section class="vh-recommendations" aria-label="视频推荐">
      <div class="vh-recommendations__header">
        <h2 class="vh-recommendations__title">推荐</h2>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="changeRecommendationMode"
        />
      </div>

      <PContentProgress
        :loading="recommendationLoading"
        :error="recommendationError"
        :retry="fetchRecommendedVideos"
      >
        <template #skeleton>
          <div class="vh-grid">
            <div v-for="i in 4" :key="i" class="vh-skel">
              <PSkeleton variant="rect" height="auto" style="aspect-ratio: 16/9; width: 100%;" />
              <div class="vh-skel-info">
                <PSkeleton variant="rect" width="2.25rem" height="2.25rem" style="flex-shrink: 0; border-radius: var(--a-radius-control);" />
                <div class="vh-skel-lines">
                  <PSkeleton variant="text" width="85%" />
                  <PSkeleton variant="text" width="55%" />
                </div>
              </div>
            </div>
          </div>
        </template>
        <PEmpty v-if="recommendedVideos.length === 0" title="暂无推荐" description="探索更多频道或搜索你感兴趣的视频。" />
        <div v-else class="vh-grid vh-grid--recommendation">
          <article v-for="video in recommendedVideos" :key="video.id" class="vh-recommendation-item">
            <PVideoCard :video="video" />
            <PDropdown position="left">
              <template #trigger><button type="button" class="vh-recommendation-feedback" :aria-label="`调整 ${video.title} 推荐`" title="调整推荐"><More :size="18" aria-hidden="true" /></button></template>
              <template #default="{ close }"><div class="vh-recommendation-menu" role="menu">
                <button type="button" role="menuitem" @click="submitRecommendationFeedback('video', video.id, video.id, close)">不感兴趣</button>
                <button v-if="video.channel?.id" type="button" role="menuitem" @click="submitRecommendationFeedback('channel', video.channel.id, video.id, close)">减少该频道</button>
                <button v-for="tag in video.tags || []" :key="tag.id" type="button" role="menuitem" @click="submitRecommendationFeedback('tag', tag.id, video.id, close)">屏蔽 #{{ tag.name }}</button>
              </div></template>
            </PDropdown>
          </article>
        </div>
        <PaginationBar
          v-if="recommendationMeta.total > recommendationMeta.page_size"
          :meta="recommendationMeta"
          :loading="recommendationLoading"
          @change="changeRecommendationPage"
        />
      </PContentProgress>
      <p v-if="recommendationFeedbackError" class="a-error" role="alert">{{ recommendationFeedbackError }}</p>
    </section>

    <!-- Sticky filter bar -->
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
      </div>
    </div>

    <!-- Main Videos List -->
    <PContentProgress
      :loading="loading"
      :error="videoError"
      :retry="fetchVideos"
    >
      <template #skeleton>
        <div class="vh-grid">
          <div v-for="i in 8" :key="i" class="vh-skel">
            <PSkeleton variant="rect" height="auto" style="aspect-ratio: 16/9; width: 100%;" />
            <div class="vh-skel-info">
              <PSkeleton variant="rect" width="2.25rem" height="2.25rem" style="flex-shrink: 0; border-radius: var(--a-radius-control);" />
              <div class="vh-skel-lines">
                <PSkeleton variant="text" width="85%" />
                <PSkeleton variant="text" width="55%" />
              </div>
            </div>
          </div>
        </div>
      </template>
      <PEmpty v-if="videos.length === 0" title="暂无视频" description="当前分区还没有发布视频。" />
      <div v-else class="vh-grid">
        <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
      </div>
      <nav v-if="publicCollections.length" class="vh-public-collections" aria-label="公开视频合集">
        <h2>视频合集</h2>
        <div>
          <RouterLink v-for="collection in publicCollections" :key="collection.id" :to="'/videos/collections/' + collection.id">{{ collection.name }}</RouterLink>
        </div>
      </nav>
      <PaginationBar
        v-if="videoMeta.total > videoMeta.page_size"
        :meta="videoMeta"
        :loading="loading"
        @change="changeVideoPage"
      />
    </PContentProgress>
  </div>
</template>

<style scoped>
.vh-wrap {
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}

.vh-public-collections { margin: 1.5rem 0; }
.vh-public-collections h2 { font-size: 1rem; font-weight: 500; margin: 0 0 0.75rem; }
.vh-public-collections > div { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.vh-public-collections a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }

.vh-search {
  width: min(22rem, 38vw);
}

.vh-recommendations {
  margin-bottom: 1.5rem;
}

.vh-recommendations__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.vh-recommendations__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.vh-recommendation-item { position: relative; min-width: 0; }
.vh-recommendation-item :deep(.p-dropdown-root) {
  position: absolute;
  top: 8px;
  right: 44px;
  z-index: 5;
}
.vh-recommendation-feedback {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.vh-recommendation-item:hover .vh-recommendation-feedback,
.vh-recommendation-item:focus-within .vh-recommendation-feedback {
  opacity: 1;
}
.vh-recommendation-feedback:hover {
  border-color: var(--a-color-border);
}
@media (hover: none) {
  .vh-recommendation-feedback {
    opacity: 1;
  }
}
.vh-recommendation-menu { display: grid; min-width: 10rem; padding: .25rem; background: var(--a-color-bg); border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); }
.vh-recommendation-menu button { min-height: 2.25rem; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-fg); text-align: left; padding: 0 0.75rem; cursor: pointer; }
.vh-recommendation-menu button:hover { background: var(--a-color-surface-muted); }


/* Sticky filter bar */
.vh-bar {
  position: sticky;
  top: var(--a-topbar-height, 56px);
  z-index: 10;
  background: var(--a-color-bg);
  border-top: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0 0.75rem;
  margin-bottom: 1.25rem;
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
  height: var(--a-control-height-sm, 2.25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.85rem;
  font-size: 0.82rem;
  font-weight: 500;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  cursor: pointer;
  color: var(--a-color-muted);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}

.vh-chip:hover {
  border-color: var(--a-color-border);
  color: var(--a-color-fg);
}

.vh-chip--active {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 7%, var(--a-color-bg));
  color: var(--a-color-primary);
}

/* Grid */
.vh-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 2rem 1.25rem;
}

@media (max-width: 720px) {
  .vh-search {
    width: 100%;
  }
}

@media (min-width: 520px) {
  .vh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 840px) {
  .vh-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 1280px) {
  .vh-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

/* Skeleton card */
.vh-skel { display: flex; flex-direction: column; gap: 0; }
.vh-skel-info {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0 0;
}
.vh-skel-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.1rem;
}

.vh-empty {
  text-align: center;
  padding: 6rem 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}
</style>
