<script setup lang="ts">
import { createVideoRecommendationFeedback, getVideoRecommendations, listVideos, type VideoRecommendationFeedbackScope } from '@/api/video'
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
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import { IconDots as More } from '@tabler/icons-vue'
import { useAuthStore } from '@/stores/auth'
import type { ReferenceTarget } from '@/api/references'
import { modulePathUrl } from '@/router/siteUrls'

const videos = ref<Video[]>([])
const router = useRouter()
const authStore = useAuthStore()
const videoSearchTypes = ['video'] as const
const videoSearchQuery = ref('')
const recommendedVideos = ref<Video[]>([])
const loading = ref(false)
const recommendationLoading = ref(false)
const sort = ref<'latest' | 'popular'>('latest')
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const recommendationMeta = ref({ page: 1, page_size: 8, total: 0, has_more: false })
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

function openVideoSearchTarget(target: ReferenceTarget) {
  void router.push(modulePathUrl('video', target.path))
}

async function fetchVideos() {
  const seq = ++fetchVideosSeq
  loading.value = true
  try {
    const data = await listVideos(sort.value)
    if (seq === fetchVideosSeq) videos.value = data
  } finally {
    if (seq === fetchVideosSeq) loading.value = false
  }
}

async function fetchRecommendedVideos() {
  const seq = ++fetchRecommendationsSeq
  recommendationLoading.value = true
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
    if (seq === fetchRecommendationsSeq) recommendedVideos.value = []
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
  const response = await createVideoRecommendationFeedback(scope, targetID, authStore.token ?? undefined)
  if (!response.ok) throw new Error('推荐反馈提交失败')
  recommendedVideos.value = recommendedVideos.value.filter(video => video.id !== videoID)
  close()
}

onMounted(() => {
  void fetchVideos()
  void fetchRecommendedVideos()
})
watch(sort, fetchVideos)
</script>

<template>
  <div class="vh-wrap">
    <PPageHeader title="视频" mb="1.25rem">
      <template #action>
        <div class="vh-search">
          <ModuleSearch
            v-model="videoSearchQuery"
            :target-types="videoSearchTypes"
            placeholder="搜索视频"
            input-test-id="video-module-search-input"
            dropdown-test-id="video-module-search-dropdown"
            @select="openVideoSearchTarget"
          />
        </div>
      </template>
    </PPageHeader>

    <ContentContinueSection module="video" />

    <section class="vh-recommendations" aria-label="视频推荐">
      <div class="vh-recommendations__header">
        <div>
          <h2 class="vh-recommendations__title">推荐</h2>
          <p class="vh-recommendations__note">按热度、精选、探索切换当前视频推荐。</p>
        </div>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="changeRecommendationMode"
        />
      </div>

      <PContentProgress
        :loading="recommendationLoading"
        :retry="fetchRecommendedVideos"
      >
        <template #skeleton>
          <div class="vh-grid">
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
      :retry="fetchVideos"
    >
      <template #skeleton>
        <div class="vh-grid">
          <div v-for="i in 8" :key="i" class="vh-skel">
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
      </template>
      <PEmpty v-if="videos.length === 0" title="暂无视频" description="当前分区还没有发布视频。" />
      <div v-else class="vh-grid">
        <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
      </div>
    </PContentProgress>
  </div>
</template>

<style scoped>
.vh-wrap {
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}

.vh-search {
  width: min(22rem, 38vw);
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
  font-weight: 500;
}

.vh-recommendations__note {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.85rem;
}
.vh-recommendation-item { position: relative; min-width: 0; }
.vh-recommendation-feedback { position: absolute; top: .5rem; right: .5rem; display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; background: rgba(0,0,0,.7); color: #fff; cursor: pointer; }
.vh-recommendation-menu { display: grid; min-width: 10rem; padding: .25rem; background: var(--a-color-surface); border: 1px solid var(--a-color-border); }
.vh-recommendation-menu button { min-height: 2.25rem; border: 0; background: transparent; color: var(--a-color-fg); text-align: left; cursor: pointer; }
.vh-recommendation-menu button:hover { background: var(--a-color-surface-muted); }


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
  padding: 0.35rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-pill, 999px);
  background: var(--a-color-bg);
  cursor: pointer;
  color: var(--a-color-muted);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}

.vh-chip:hover {
  border-color: var(--a-color-border);
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.vh-chip--active {
  border-color: var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

/* Grid */
.vh-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 2rem 1.25rem;
}

@media (max-width: 720px) {
  .vh-search {
    width: 100%;
  }
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
  border-radius: 4px;
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
