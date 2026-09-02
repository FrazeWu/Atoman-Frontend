<template>
  <main class="portal-hot">
    <header class="portal-hot__hero">
      <div class="portal-hot__hero-content">
        <div>
          <p class="portal-hot__kicker">今日焦点</p>
          <h1 class="portal-hot__hero-title">从全站挑出的内容</h1>
          <p class="portal-hot__hero-subtitle">优先呈现正在发生、值得阅读和跨领域可探索的高质量内容。</p>
        </div>
        <div class="portal-hot__hero-actions">
          <PButton variant="primary" size="md" :to="moduleUrl('feed')">进入订阅</PButton>
          <a href="#spotlight" class="portal-hot__secondary-btn">查看焦点精选</a>
        </div>
      </div>
    </header>

    <div id="spotlight" class="portal-hot__container">
      <PContentProgress
        :loading="loading"
        :error="error"
        :retry="loadHotContent"
      >
        <template #skeleton>
          <div class="portal-hot__loading-stream feed-timeline-box">
            <div v-for="index in 4" :key="index" style="padding: 1rem; border-bottom: 1px solid var(--a-color-border-soft);">
              <PSkeleton width="40%" height="16px" style="margin-bottom: 8px;" />
              <PSkeleton width="80%" height="20px" style="margin-bottom: 8px;" />
              <PSkeleton width="100%" height="14px" />
            </div>
          </div>
        </template>

        <template v-if="hasContent">
          <section v-if="recommendationItems.length" class="portal-hot__recommendations" aria-label="推荐内容">
            <div class="portal-hot__section-header">
              <div>
                <p class="portal-hot__kicker">今日推荐</p>
                <h2>焦点精选</h2>
              </div>
              <span class="portal-hot__header-line" />
              <PButton
                v-if="canRefreshSpotlight"
                type="button"
                size="sm"
                variant="ghost"
                data-test="portal-refresh-spotlight"
                title="换一批焦点精选"
                aria-label="换一批焦点精选"
                :loading="spotlightLoading"
                @click="refreshSpotlight"
              >
                <RefreshCw :size="14" aria-hidden="true" />
              </PButton>
            </div>
            <p v-if="spotlightError" class="a-error" role="alert">{{ spotlightError }}</p>

            <div class="portal-hot__spotlight-layout">
              <RouterLink
                v-if="spotlightLead"
                :to="spotlightLead.target_path"
                class="portal-hot__spotlight-lead"
              >
                <div class="portal-hot__spotlight-media portal-hot__spotlight-media--lead" :class="`portal-hot__spotlight-media--${spotlightLead.module}`">
                  <img
                    v-if="spotlightLead.image_url && !failedImageKeys.has(recommendationKey(spotlightLead))"
                    :src="spotlightLead.image_url"
                    :alt="spotlightLead.title"
                    referrerpolicy="no-referrer"
                    loading="eager"
                    fetchpriority="high"
                    @error="handleImageError(recommendationKey(spotlightLead))"
                  >
                  <component v-else :is="moduleIcon(spotlightLead.module)" :size="40" aria-hidden="true" />
                </div>
                <div class="portal-hot__spotlight-lead-copy">
                  <div class="portal-hot__spotlight-meta">
                    <span class="portal-hot__tag">{{ moduleLabel(spotlightLead.module) }}</span>
                    <span v-if="spotlightLead.published_at" class="portal-hot__date">{{ formatDate(spotlightLead.published_at) }}</span>
                  </div>
                  <h3>{{ spotlightLead.title }}</h3>
                  <p v-if="spotlightLead.summary">{{ spotlightLead.summary }}</p>
                  <span class="portal-hot__reason" data-test="portal-spotlight-reason">
                    <Sparkles :size="13" aria-hidden="true" />
                    {{ spotlightReason(spotlightLead) }}
                  </span>
                </div>
              </RouterLink>

              <div class="portal-hot__spotlight-rail">
                <RouterLink
                  v-for="item in spotlightRailItems"
                  :key="recommendationKey(item)"
                  :to="item.target_path"
                  class="portal-hot__spotlight-rail-item"
                >
                  <div class="portal-hot__spotlight-media portal-hot__spotlight-media--rail" :class="`portal-hot__spotlight-media--${item.module}`">
                    <img
                      v-if="item.image_url && !failedImageKeys.has(recommendationKey(item))"
                      :src="item.image_url"
                      :alt="item.title"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      @error="handleImageError(recommendationKey(item))"
                    >
                    <component v-else :is="moduleIcon(item.module)" :size="21" aria-hidden="true" />
                  </div>
                  <div class="portal-hot__spotlight-rail-copy">
                    <div class="portal-hot__spotlight-meta">
                      <span class="portal-hot__tag">{{ moduleLabel(item.module) }}</span>
                      <span v-if="item.published_at" class="portal-hot__date">{{ formatDate(item.published_at) }}</span>
                    </div>
                    <h3>{{ item.title }}</h3>
                    <span class="portal-hot__reason" data-test="portal-spotlight-reason">
                      <Sparkles :size="12" aria-hidden="true" />
                      {{ spotlightReason(item) }}
                    </span>
                  </div>
                </RouterLink>
              </div>
            </div>
          </section>

          <section v-if="contentStreamItems.length" class="portal-hot__content-stream" aria-label="全站热门内容">
            <RouterLink
              v-for="item in contentStreamItems"
              :key="recommendationKey(item)"
              :to="item.target_path"
              class="portal-hot__content-stream-item"
            >
              <div class="portal-hot__stream-media" :class="`portal-hot__spotlight-media--${item.module}`">
                <img
                  v-if="item.image_url && !failedImageKeys.has(recommendationKey(item))"
                  :src="item.image_url"
                  :alt="item.title"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  @error="handleImageError(recommendationKey(item))"
                >
                <component v-else :is="moduleIcon(item.module)" :size="22" aria-hidden="true" />
              </div>
              <div class="portal-hot__stream-copy">
                <div class="portal-hot__spotlight-meta">
                  <span class="portal-hot__tag">{{ moduleLabel(item.module) }}</span>
                  <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                  <span v-if="item.published_at" class="portal-hot__date">{{ formatDate(item.published_at) }}</span>
                </div>
                <h2>{{ item.title }}</h2>
                <p v-if="item.summary">{{ item.summary }}</p>
              </div>
            </RouterLink>
          </section>

          <nav v-if="!contentStreamItems.length" class="portal-hot__module-strip" aria-label="探索更多模块">
            <span>探索更多模块：</span>
            <div class="portal-hot__strip-links">
              <RouterLink
                v-for="room in otherRooms"
                :key="room.key"
                :to="moduleUrl(room.key)"
              >{{ room.name }}</RouterLink>
            </div>
          </nav>
        </template>

        <section v-else class="portal-hot__empty">
          <p class="portal-hot__kicker">暂无内容</p>
          <h2>还没有可展示的热点内容</h2>
          <p>可以先从任一模块开始发布、订阅或讨论，首页会自动汇总最活跃的内容。</p>
          <div class="portal-hot__fallback-links">
            <RouterLink
              v-for="room in visibleRooms"
              :key="room.key"
              :to="moduleUrl(room.key)"
            >
              {{ room.name }}
            </RouterLink>
          </div>
        </section>
      </PContentProgress>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { IconBook2 as BookOpen, IconClock as Clock3, IconFileText as FileText, IconMessageCircle as MessageCircle, IconMusic as Music2, IconRadio as Radio, IconRefresh as RefreshCw, IconRss as Rss, IconSparkles as Sparkles, IconVideo as VideoIcon } from '@tabler/icons-vue'
import { RouterLink } from 'vue-router'
import { apiRequestResult } from '@/api/client'

import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import { useApi } from '@/composables/useApi'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { moduleUrl } from '@/router/siteUrls'
import { useSiteAccessStore } from '@/stores/siteAccess'
interface PortalHotItem {
  id: string
  module: string
  kind: string
  title: string
  summary: string
  image_url: string
  target_path: string
  score: number
  score_label: string
  published_at?: string
}

interface PortalHotSection {
  module: string
  title: string
  items: PortalHotItem[]
}

interface PortalHotResponse {
  featured: PortalHotItem[]
  featured_total?: number
  sections: PortalHotSection[]
}

const api = useApi()
const siteAccessStore = useSiteAccessStore()

const loading = ref(true)
const spotlightLoading = ref(false)
const error = ref('')
const spotlightError = ref('')
const hotContent = ref<PortalHotResponse>({ featured: [], sections: [] })
const failedImageKeys = ref<Set<string>>(new Set())
const spotlightBatch = ref(0)
const spotlightPageSize = 4

function handleImageError(key: string) {
  failedImageKeys.value.add(key)
}

function recommendationKey(item: PortalHotItem) {
  return `${item.module}:${item.id}`
}

const moduleIcons: Record<string, Component> = {
  blog: BookOpen,
  feed: Rss,
  music: Music2,
  video: VideoIcon,
  podcast: Radio,
  forum: MessageCircle,
  timeline: Clock3,
}

function moduleIcon(module: string) {
  return moduleIcons[module] ?? FileText
}

function spotlightReason(item: PortalHotItem) {
  return item.score_label || `${moduleLabel(item.module)}精选`
}

const visibleRooms = computed(() => (
  moduleNavOrder
    .filter((key) => siteAccessStore.isModuleVisible(key))
    .map((key) => moduleRooms[key])
))

const visibleSections = computed(() => (
  hotContent.value.sections.filter((section) => (
    isModuleRoomKey(section.module) && siteAccessStore.isModuleVisible(section.module)
  ))
))

const visibleFeatured = computed(() => (
  hotContent.value.featured.filter((item) => (
    isModuleRoomKey(item.module) && siteAccessStore.isModuleVisible(item.module)
  ))
))

const recommendationItems = computed(() => visibleFeatured.value.slice(0, spotlightPageSize))
const spotlightLead = computed(() => recommendationItems.value[0])
const spotlightRailItems = computed(() => recommendationItems.value.slice(1))
const spotlightBatchCount = computed(() => Math.ceil(
  (hotContent.value.featured_total ?? recommendationItems.value.length) / spotlightPageSize,
))
const canRefreshSpotlight = computed(() => spotlightBatchCount.value > 1)
const recommendedItemKeys = computed(() => new Set(
  recommendationItems.value.map((item) => `${item.module}:${item.id}`),
))
const displaySections = computed(() => visibleSections.value
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => !recommendedItemKeys.value.has(`${item.module}:${item.id}`)),
  }))
  .filter((section) => section.items.length > 0))
const contentStreamItems = computed(() => displaySections.value.flatMap((section) => section.items))
const otherRooms = computed(() => visibleRooms.value)
const hasContent = computed(() => visibleFeatured.value.length > 0 || contentStreamItems.value.length > 0)

async function loadHotContent(batch = spotlightBatch.value) {
  const initialLoad = !hasContent.value
  if (initialLoad) {
    loading.value = true
    error.value = ''
  } else {
    spotlightLoading.value = true
    spotlightError.value = ''
  }
  try {
    const response = await apiRequestResult(`${api.url}/portal/hot?limit=6&spotlight_offset=${batch * spotlightPageSize}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) {
      hotContent.value = { featured: [], sections: [] }
      spotlightBatch.value = batch
      return
    }
    if (!response.ok) throw new Error('服务端返回异常')
    const payload = await Promise.resolve(response.data) as { data?: PortalHotResponse }
    hotContent.value = payload.data ?? { featured: [], sections: [] }
    spotlightBatch.value = batch
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    if (initialLoad) error.value = message
    else spotlightError.value = message
  } finally {
    if (initialLoad) loading.value = false
    else spotlightLoading.value = false
  }
}

function refreshSpotlight() {
  if (!canRefreshSpotlight.value || spotlightLoading.value) return
  void loadHotContent((spotlightBatch.value + 1) % spotlightBatchCount.value)
}

function isModuleRoomKey(value: string): value is ModuleRoomKey {
  return value in moduleRooms
}

function moduleLabel(value: string) {
  return isModuleRoomKey(value) ? moduleRooms[value].name : '内容'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  } catch {
    return ''
  }
}

onMounted(loadHotContent)
</script>

<style scoped>
.portal-hot {
  min-height: calc(100vh - 56px);
  padding-bottom: 96px;
  background: var(--a-color-bg);
}

/* ─── Content-first intro ─────────────────────────────── */
.portal-hot__hero {
  padding: 1.75rem 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.portal-hot__hero-content {
  width: min(1200px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.portal-hot__hero-title {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
}

.portal-hot__hero-subtitle {
  max-width: 42rem;
  margin: 0.45rem 0 0;
  color: var(--a-color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.portal-hot__hero-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
}

.portal-hot__secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text);
  text-decoration: none;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  transition: all 0.2s ease;
}

.portal-hot__secondary-btn:hover {
  border-color: var(--a-color-text);
  background: var(--a-color-surface);
}

/* ─── Container ────────────────────────────────────────── */
.portal-hot__container {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 48px 24px 0;
}

.portal-hot__kicker {
  margin: 0 0 6px;
  color: var(--a-color-primary);
  font-family: var(--a-font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ─── Spotlight Featured Recommendations (信息流) ──────── */
.portal-hot__recommendations {
  margin-bottom: 56px;
}

.portal-hot__section-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.portal-hot__section-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  color: var(--a-color-text);
}

.portal-hot__header-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--a-color-border-soft) 0%, transparent 100%);
}

.portal-hot__spotlight-lead,
.portal-hot__spotlight-rail-item,
.portal-hot__content-stream-item {
  display: block;
  color: inherit;
  text-decoration: none;
}

.portal-hot__spotlight-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(18rem, 1fr);
  gap: 1.25rem;
}

.portal-hot__spotlight-lead {
  display: grid;
  grid-template-columns: minmax(12rem, 1.08fr) minmax(0, 1fr);
  min-height: 21rem;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.portal-hot__spotlight-media {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  color: var(--a-color-primary);
}

.portal-hot__spotlight-media--lead {
  min-height: 21rem;
}

.portal-hot__spotlight-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__spotlight-media--blog { background: color-mix(in srgb, #16a34a 12%, var(--a-color-surface)); color: #15803d; }
.portal-hot__spotlight-media--feed { background: color-mix(in srgb, #2563eb 12%, var(--a-color-surface)); color: #2563eb; }
.portal-hot__spotlight-media--music { background: color-mix(in srgb, #8b5cf6 12%, var(--a-color-surface)); color: #7c3aed; }
.portal-hot__spotlight-media--video { background: color-mix(in srgb, #ea580c 12%, var(--a-color-surface)); color: #c2410c; }
.portal-hot__spotlight-media--podcast { background: color-mix(in srgb, #db2777 12%, var(--a-color-surface)); color: #be185d; }
.portal-hot__spotlight-media--forum,
.portal-hot__spotlight-media--debate { background: color-mix(in srgb, #4f46e5 12%, var(--a-color-surface)); color: #4338ca; }
.portal-hot__spotlight-media--timeline { background: color-mix(in srgb, #0891b2 12%, var(--a-color-surface)); color: #0e7490; }

.portal-hot__spotlight-lead-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  padding: 1.5rem;
}

.portal-hot__spotlight-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.portal-hot__spotlight-lead h3,
.portal-hot__spotlight-rail-item h3 {
  margin: 0;
  color: var(--a-color-text);
  font-weight: 600;
  line-height: 1.35;
}

.portal-hot__spotlight-lead h3 {
  margin-top: 0.85rem;
  font-size: 1.35rem;
}

.portal-hot__spotlight-lead p {
  display: -webkit-box;
  margin: 0.65rem 0 0;
  overflow: hidden;
  color: var(--a-color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.portal-hot__spotlight-lead .portal-hot__reason {
  margin-top: 1rem;
}

.portal-hot__spotlight-rail {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.portal-hot__spotlight-rail-item {
  display: grid;
  grid-template-columns: 5.25rem minmax(0, 1fr);
  min-height: 6.4rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.portal-hot__spotlight-rail-item:last-child {
  border-bottom: 0;
}

.portal-hot__spotlight-media--rail {
  aspect-ratio: 1;
  align-self: center;
  border-radius: var(--a-radius-control);
}

.portal-hot__spotlight-rail-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 0.5rem 0 0.5rem 0.9rem;
}

.portal-hot__spotlight-rail-item h3 {
  display: -webkit-box;
  margin-top: 0.42rem;
  overflow: hidden;
  font-size: 0.95rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.portal-hot__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1em 0.45em;
  border-radius: var(--a-radius-control);
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.portal-hot__tag--feed {
  background: color-mix(in srgb, #2563eb 12%, transparent);
  color: #2563eb;
}

.portal-hot__tag--blog {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: #16a34a;
}

.portal-hot__tag--music {
  background: color-mix(in srgb, #8b5cf6 12%, transparent);
  color: #8b5cf6;
}

.portal-hot__tag--video {
  background: color-mix(in srgb, #ea580c 12%, transparent);
  color: #ea580c;
}

.portal-hot__score {
  font-size: 0.68rem;
  color: var(--a-color-primary);
  font-weight: 600;
}

.portal-hot__date {
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
}

.portal-hot__reason {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--a-color-text-secondary);
  font-size: 0.74rem;
}

/* ─── Continuous Content Stream ───────────────────────── */
.portal-hot__content-stream {
  max-width: 52rem;
  margin: 0 auto;
  border-top: 1px solid var(--a-color-border-soft);
}

.portal-hot__content-stream-item {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1rem;
  min-height: 8.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.portal-hot__content-stream-item:hover h2 {
  color: var(--a-color-primary);
}

.portal-hot__stream-media {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  align-self: center;
  overflow: hidden;
  border-radius: var(--a-radius-control);
}

.portal-hot__stream-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__stream-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.portal-hot__stream-copy h2 {
  display: -webkit-box;
  margin: 0.45rem 0 0;
  overflow: hidden;
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.portal-hot__stream-copy p {
  display: -webkit-box;
  margin: 0.4rem 0 0;
  overflow: hidden;
  color: var(--a-color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

/* ─── Module Strip ─────────────────────────────────────── */
.portal-hot__module-strip {
  margin-top: 48px;
  padding: 16px 24px;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--a-color-text-secondary);
}

.portal-hot__strip-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.portal-hot__strip-links a {
  color: var(--a-color-text);
  text-decoration: none;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  transition: all 0.15s ease;
}

.portal-hot__strip-links a:hover {
  border-color: var(--a-color-text);
  background: var(--a-color-surface);
}

/* ─── Empty State ──────────────────────────────────────── */
.portal-hot__empty {
  padding: 64px 24px;
  text-align: center;
}

.portal-hot__empty h2 {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 500;
  color: var(--a-color-text);
}

.portal-hot__empty p {
  margin: 0 auto 24px;
  max-width: 480px;
  color: var(--a-color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.portal-hot__fallback-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.portal-hot__fallback-links a {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text);
  text-decoration: none;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  transition: all 0.15s ease;
}

.portal-hot__fallback-links a:hover {
  border-color: var(--a-color-text);
  background: var(--a-color-surface);
}

@media (max-width: 768px) {
  .portal-hot {
    padding-bottom: 1.5rem;
  }

  .portal-hot__hero {
    padding: 1.25rem 1rem;
  }

  .portal-hot__hero-content {
    align-items: flex-start;
    flex-direction: column;
    gap: 1rem;
  }

  .portal-hot__hero-title {
    font-size: 1.5rem;
  }

  .portal-hot__hero-actions {
    width: 100%;
  }

  .portal-hot__container {
    padding: 1.5rem 1rem 0;
  }

  .portal-hot__section-header {
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .portal-hot__section-header h2 {
    font-size: 1.25rem;
  }

  .portal-hot__spotlight-layout {
    grid-template-columns: 1fr;
  }

  .portal-hot__spotlight-lead {
    grid-template-columns: minmax(8rem, 0.8fr) minmax(0, 1fr);
    min-height: 0;
  }

  .portal-hot__spotlight-media--lead {
    min-height: 12rem;
  }

  .portal-hot__spotlight-lead-copy {
    padding: 1rem;
  }

  .portal-hot__spotlight-lead h3 {
    margin-top: 0.6rem;
    font-size: 1.08rem;
  }

  .portal-hot__spotlight-lead p {
    -webkit-line-clamp: 3;
  }

  .portal-hot__spotlight-rail {
    gap: 0;
  }

  .portal-hot__content-stream-item {
    grid-template-columns: 5.25rem minmax(0, 1fr);
    gap: 0.75rem;
    min-height: 7rem;
  }
}
</style>
