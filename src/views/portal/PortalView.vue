<template>
  <main class="portal-hot">
    <!-- Hero Banner -->
    <header class="portal-hot__hero">
      <div class="portal-hot__hero-glow" />
      <div class="portal-hot__hero-content">
        <div class="portal-hot__hero-badge">
          <span class="portal-hot__badge-dot" />
          <span>ATOMAN</span>
        </div>
        <h1 class="portal-hot__hero-title">
          3 分钟建立你的<br>
          <span class="portal-hot__hero-gradient">高质量内容订阅流</span>
        </h1>
        <p class="portal-hot__hero-subtitle">
          聚合博客、播客、音乐与讨论，不用在多个平台反复筛选。
        </p>
        <div class="portal-hot__hero-actions">
          <PButton variant="primary" size="md" :to="moduleUrl('feed')">
            浏览今日精选
          </PButton>
          <a href="#sections" class="portal-hot__secondary-btn">
            查看真实内容
          </a>
        </div>
      </div>
    </header>

    <div id="sections" class="portal-hot__container">
      <PContentProgress
        :loading="loading"
        :error="error"
        :retry="loadHotContent"
      >
        <template #skeleton>
          <div class="portal-hot__loading-grid">
            <div v-for="index in 4" :key="index" class="portal-hot__card-skeleton">
              <PSkeleton height="140px" style="margin-bottom: 12px;" />
              <PSkeleton width="60%" height="20px" style="margin-bottom: 8px;" />
              <PSkeleton width="90%" height="16px" />
            </div>
          </div>
        </template>

        <template v-if="hasContent">
          <!-- 核心推荐 (Featured Spotlight) -->
          <section v-if="recommendationItems.length" class="portal-hot__recommendations" aria-label="推荐内容">
            <div class="portal-hot__section-header">
              <div>
                <p class="portal-hot__kicker">SPOTLIGHT</p>
                <h2>焦点精选</h2>
              </div>
              <span class="portal-hot__header-line" />
            </div>
            <div class="portal-hot__recommendation-grid">
              <RouterLink
                v-for="item in recommendationItems"
                :key="`${item.module}-${item.id}`"
                :to="item.target_path"
                class="portal-hot__recommendation-card-link"
              >
                <PEntry
                  :title="item.title"
                  :summary="item.summary"
                  class="portal-hot__recommendation-card"
                  :class="{ 'has-image': item.image_url }"
                >
                  <template v-if="item.image_url" #visual>
                    <div class="portal-hot__recommendation-image">
                      <img
                        :src="item.image_url"
                        :alt="item.title"
                        :loading="isPriorityImage(item) ? 'eager' : 'lazy'"
                        :fetchpriority="isPriorityImage(item) ? 'high' : 'auto'"
                      >
                      <div class="portal-hot__image-overlay" />
                    </div>
                  </template>

                  <template #meta>
                    <span class="portal-hot__tag">{{ moduleLabel(item.module) }}</span>
                    <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                  </template>

                  <template #footer>
                    <span class="portal-hot__read-more">阅读更多 ›</span>
                  </template>
                </PEntry>
              </RouterLink>
            </div>
          </section>

          <!-- 分模块热门内容 (Sections) -->
          <section class="portal-hot__sections" aria-label="模块热门内容">
            <article
              v-for="section in displaySections"
              :key="section.module"
              class="portal-hot__section"
            >
              <div class="portal-hot__section-head">
                <div class="portal-hot__section-title-group">
                  <span class="portal-hot__section-badge">{{ moduleLabel(section.module) }}</span>
                  <h2>{{ section.title }}</h2>
                </div>
                <RouterLink :to="moduleHomePath(section.module)" class="portal-hot__module-link">
                  <span>查看全部</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </RouterLink>
              </div>

              <!-- 使用标准流式容器 .feed-timeline-box 包裹 PEntry 卡片 -->
              <div class="feed-timeline-box">
                <RouterLink
                  v-for="item in section.items"
                  :key="`${section.module}-${item.id}`"
                  :to="item.target_path"
                  class="portal-hot__card-link"
                >
                  <PEntry
                    :title="item.title"
                    :summary="item.summary"
                    class="content-stream-entry portal-hot__card"
                  >
                    <template v-if="item.image_url" #visual>
                      <div class="portal-hot__thumb">
                        <img
                          :src="item.image_url"
                          :alt="item.title"
                          :loading="isPriorityImage(item) ? 'eager' : 'lazy'"
                          :fetchpriority="isPriorityImage(item) ? 'high' : 'auto'"
                        >
                        <div class="portal-hot__thumb-overlay" />
                      </div>
                    </template>

                    <template #meta>
                      <span class="portal-hot__tag">{{ moduleLabel(section.module) }}</span>
                      <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                      <span v-if="item.published_at" class="portal-hot__date">{{ formatDate(item.published_at) }}</span>
                    </template>
                  </PEntry>
                </RouterLink>
              </div>
            </article>
          </section>

          <nav v-if="!displaySections.length" class="portal-hot__module-strip" aria-label="探索更多模块">
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
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequestResult } from '@/api/client'

import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PEntry from '@/components/ui/PEntry.vue'
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
  sections: PortalHotSection[]
}

const api = useApi()
const siteAccessStore = useSiteAccessStore()

const loading = ref(true)
const error = ref('')
const hotContent = ref<PortalHotResponse>({ featured: [], sections: [] })

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

const recommendationItems = computed(() => visibleFeatured.value.slice(0, 4))
const recommendedItemKeys = computed(() => new Set(
  recommendationItems.value.map((item) => `${item.module}:${item.id}`),
))
const displaySections = computed(() => visibleSections.value
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => !recommendedItemKeys.value.has(`${item.module}:${item.id}`)),
  }))
  .filter((section) => section.items.length > 0))
const priorityImageKey = computed(() => {
  const item = recommendationItems.value.find((candidate) => candidate.image_url)
    ?? displaySections.value.flatMap((section) => section.items).find((candidate) => candidate.image_url)
  return item ? `${item.module}:${item.id}` : ''
})
const otherRooms = computed(() => visibleRooms.value)
const hasContent = computed(() => visibleFeatured.value.length > 0 || displaySections.value.length > 0)

async function loadHotContent() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiRequestResult(`${api.url}/portal/hot?limit=6`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) {
      hotContent.value = { featured: [], sections: [] }
      return
    }
    if (!response.ok) throw new Error('服务端返回异常')
    const payload = await Promise.resolve(response.data) as { data?: PortalHotResponse }
    hotContent.value = payload.data ?? { featured: [], sections: [] }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function isModuleRoomKey(value: string): value is ModuleRoomKey {
  return value in moduleRooms
}

function moduleLabel(value: string) {
  return isModuleRoomKey(value) ? moduleRooms[value].name : '内容'
}

function moduleHomePath(value: string) {
  return isModuleRoomKey(value) ? moduleUrl(value) : '/'
}

function isPriorityImage(item: PortalHotItem) {
  return `${item.module}:${item.id}` === priorityImageKey.value
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

/* ─── Hero Banner ─────────────────────────────────────── */
.portal-hot__hero {
  position: relative;
  overflow: hidden;
  padding: 72px 24px 64px;
  background: linear-gradient(180deg, var(--a-color-surface) 0%, var(--a-color-bg) 100%);
  border-bottom: 1px solid var(--a-color-border-soft);
  text-align: center;
}

.portal-hot__hero-glow {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 300px;
  background: radial-gradient(circle, color-mix(in srgb, var(--a-color-primary) 12%, transparent) 0%, transparent 70%);
  pointer-events: none;
  filter: blur(40px);
}

.portal-hot__hero-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.portal-hot__hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--a-color-muted);
}

.portal-hot__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-primary);
}

.portal-hot__hero-title {
  margin: 0;
  font-size: 44px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--a-color-text);
}

.portal-hot__hero-gradient {
  background: linear-gradient(135deg, var(--a-color-text) 30%, var(--a-color-primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.portal-hot__hero-subtitle {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--a-color-text-secondary);
  max-width: 580px;
}

.portal-hot__hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
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

/* ─── Spotlight Featured Recommendations ───────────────── */
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

.portal-hot__recommendation-grid,
.portal-hot__loading-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.portal-hot__recommendation-card-link,
.portal-hot__card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.portal-hot__recommendation-card {
  margin-bottom: 0 !important;
  height: 100%;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.portal-hot__recommendation-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
  transform: translateY(-2px);
}

.portal-hot__recommendation-image {
  position: relative;
  width: 140px;
  height: 96px;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  flex-shrink: 0;
}

.portal-hot__recommendation-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.15) 100%);
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

.portal-hot__score {
  font-size: 0.68rem;
  color: var(--a-color-primary);
  font-weight: 600;
}

.portal-hot__date {
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
}

.portal-hot__read-more {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--a-color-primary);
}

/* ─── Sections ─────────────────────────────────────────── */
.portal-hot__sections {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.portal-hot__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 12px;
}

.portal-hot__section-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.portal-hot__section-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2em 0.6em;
  border-radius: var(--a-radius-control);
  font-size: 0.7rem;
  font-weight: 650;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.portal-hot__section-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: var(--a-color-text);
}

.portal-hot__module-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.portal-hot__module-link:hover {
  color: var(--a-color-text);
}

/* 标准流式容器 */
.feed-timeline-box {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  background: var(--a-color-bg);
}

.portal-hot__thumb {
  position: relative;
  width: 90px;
  height: 64px;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  flex-shrink: 0;
}

.portal-hot__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__thumb-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.1) 100%);
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
  .portal-hot__recommendation-grid,
  .portal-hot__loading-grid {
    grid-template-columns: 1fr;
  }

  .portal-hot__hero-title {
    font-size: 32px;
  }
}
</style>
