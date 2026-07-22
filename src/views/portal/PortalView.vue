<template>
  <main class="portal-hot">
    <!-- Hero Banner -->
    <header class="portal-hot__hero">
      <div class="portal-hot__hero-glow"></div>
      <div class="portal-hot__hero-content">
        <div class="portal-hot__hero-badge">
          <span class="portal-hot__badge-dot"></span>
          <span>ATOMAN PLATFORM</span>
        </div>
        <h1 class="portal-hot__hero-title">
          探索全极简与高质感<br />
          <span class="portal-hot__hero-gradient">精选社区与全域内容</span>
        </h1>
        <p class="portal-hot__hero-subtitle">
          汇总动态、音乐、博客、论战与音频等多元化高品质优质内容，随时开启深度探索与互动。
        </p>
        <div class="portal-hot__hero-actions">
          <PButton variant="primary" size="md" :to="moduleUrl('feed')">
            进入订阅流
          </PButton>
          <a href="#sections" class="portal-hot__secondary-btn">
            浏览全域模块
          </a>
        </div>
      </div>
    </header>

    <div id="sections" class="portal-hot__container">
      <section v-if="loading" class="portal-hot__loading" aria-label="热门内容加载中">
        <div class="portal-hot__loading-grid">
          <div v-for="index in 4" :key="index" class="portal-hot__card-skeleton a-skeleton" />
        </div>
      </section>

      <section v-else-if="error" class="portal-hot__empty">
        <div class="portal-hot__empty-icon">⚠️</div>
        <p class="portal-hot__kicker">加载失败</p>
        <h2>热门内容暂时没有加载出来</h2>
        <p>{{ error }}</p>
        <PButton size="sm" @click="loadHotContent">重试</PButton>
        <div class="portal-hot__fallback-links">
          <RouterLink
            v-for="room in visibleRooms"
            :key="room.key"
            :to="moduleUrl(room.key)"
          >
            先去{{ room.name }}
          </RouterLink>
        </div>
      </section>

      <template v-else-if="hasContent">
        <!-- 核心推荐 (Featured) -->
        <section v-if="recommendationItems.length" class="portal-hot__recommendations" aria-label="推荐内容">
          <div class="portal-hot__section-header">
            <div>
              <p class="portal-hot__kicker">SPOTLIGHT</p>
              <h2>焦点精选</h2>
            </div>
            <span class="portal-hot__header-line"></span>
          </div>
          <div class="portal-hot__recommendation-grid">
            <RouterLink
              v-for="item in recommendationItems"
              :key="`${item.module}-${item.id}`"
              :to="item.target_path"
              class="portal-hot__recommendation-card"
              :class="{ 'has-image': item.image_url }"
            >
              <div v-if="item.image_url" class="portal-hot__recommendation-image">
                <img :src="item.image_url" :alt="item.title" loading="lazy" />
                <div class="portal-hot__image-overlay"></div>
              </div>
              <div class="portal-hot__recommendation-body">
                <div class="portal-hot__meta-row">
                  <span class="portal-hot__tag">{{ moduleLabel(item.module) }}</span>
                  <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                </div>
                <h2>{{ item.title }}</h2>
                <p v-if="item.summary">{{ item.summary }}</p>
                <div class="portal-hot__card-footer">
                  <span class="portal-hot__read-more">阅读更多 &rarr;</span>
                </div>
              </div>
            </RouterLink>
          </div>
        </section>

        <!-- 分模块热门内容 -->
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
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </RouterLink>
            </div>

            <div class="portal-hot__grid">
              <RouterLink
                v-for="item in section.items"
                :key="`${section.module}-${item.id}`"
                :to="item.target_path"
                class="portal-hot__card"
              >
                <div v-if="item.image_url" class="portal-hot__thumb">
                  <img :src="item.image_url" :alt="item.title" loading="lazy" />
                  <div class="portal-hot__thumb-overlay"></div>
                </div>
                <div class="portal-hot__card-body">
                  <div class="portal-hot__card-meta">
                    <span>{{ item.score_label }}</span>
                  </div>
                  <strong>{{ item.title }}</strong>
                  <p v-if="item.summary">{{ item.summary }}</p>
                </div>
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
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { useApi } from '@/composables/useApi'
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
const otherRooms = computed(() => visibleRooms.value)
const hasContent = computed(() => visibleFeatured.value.length > 0 || displaySections.value.length > 0)

async function loadHotContent() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${api.url}/portal/hot?limit=6`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) {
      hotContent.value = { featured: [], sections: [] }
      return
    }
    if (!response.ok) throw new Error('服务端返回异常')
    const payload = await response.json() as { data?: PortalHotResponse }
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
  border-radius: 9999px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--a-color-muted);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.portal-hot__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-primary);
  box-shadow: 0 0 8px var(--a-color-primary);
}

.portal-hot__hero-title {
  margin: 0;
  font-size: 44px;
  font-weight: 700;
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
  border-radius: var(--a-radius-control, 4px);
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
  font-weight: 700;
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
  font-weight: 700;
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

.portal-hot__recommendation-card,
.portal-hot__card,
.portal-hot__module-link,
.portal-hot__fallback-links a {
  color: inherit;
  text-decoration: none;
}

.portal-hot__recommendation-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 180px;
  border-radius: var(--a-radius-card, 6px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
}

.portal-hot__recommendation-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--a-color-primary) 40%, var(--a-color-border));
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.07);
}

.portal-hot__recommendation-card.has-image {
  grid-template-columns: 180px minmax(0, 1fr);
}

.portal-hot__recommendation-image {
  position: relative;
  background: var(--a-color-surface-muted);
  overflow: hidden;
}

.portal-hot__recommendation-image img,
.portal-hot__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.portal-hot__recommendation-card:hover .portal-hot__recommendation-image img,
.portal-hot__card:hover .portal-hot__thumb img {
  transform: scale(1.05);
}

.portal-hot__image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.2) 100%);
}

.portal-hot__recommendation-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 20px;
}

.portal-hot__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.portal-hot__tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.portal-hot__score {
  font-size: 11px;
  color: var(--a-color-muted);
  font-weight: 500;
}

.portal-hot__recommendation-body h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--a-color-text);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.portal-hot__recommendation-body > p {
  display: -webkit-box;
  margin: 0 0 12px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--a-color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.portal-hot__card-footer {
  margin-top: auto;
}

.portal-hot__read-more {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-primary);
  transition: opacity 0.2s ease;
}

.portal-hot__recommendation-card:hover .portal-hot__read-more {
  opacity: 0.8;
}

/* ─── Module Sections ─────────────────────────────────── */
.portal-hot__sections {
  display: grid;
  gap: 48px;
}

.portal-hot__section {
  display: grid;
  gap: 18px;
}

.portal-hot__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 14px;
}

.portal-hot__section-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.portal-hot__section-badge {
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  font-size: 12px;
  font-weight: 600;
}

.portal-hot__section-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--a-color-text);
}

.portal-hot__module-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--a-color-muted);
  font-size: 13px;
  font-weight: 500;
  transition: color 0.2s ease;
}

.portal-hot__module-link:hover {
  color: var(--a-color-primary);
}

.portal-hot__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.portal-hot__card {
  display: flex;
  flex-direction: column;
  min-height: 200px;
  border-radius: var(--a-radius-card, 6px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.portal-hot__card:hover {
  transform: translateY(-2px);
  border-color: var(--a-color-border);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
}

.portal-hot__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--a-color-surface-muted);
  overflow: hidden;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.portal-hot__card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  flex: 1;
}

.portal-hot__card-meta span {
  color: var(--a-color-muted);
  font-size: 11px;
  font-weight: 600;
}

.portal-hot__card-body strong {
  color: var(--a-color-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.portal-hot__card-body p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--a-color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

/* ─── Bottom Navigation Strip ─────────────────────────── */
.portal-hot__module-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 48px;
  padding: 24px;
  border-radius: var(--a-radius-card, 6px);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
}

.portal-hot__module-strip span {
  color: var(--a-color-muted);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.portal-hot__strip-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.portal-hot__strip-links a {
  padding: 6px 12px;
  border-radius: 4px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
}

.portal-hot__strip-links a:hover {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

/* ─── Empty & Loading States ──────────────────────────── */
.portal-hot__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 64px 24px;
  border-radius: var(--a-radius-card, 6px);
  border: 1px dashed var(--a-color-border);
  background: var(--a-color-surface);
}

.portal-hot__empty-icon {
  font-size: 36px;
}

.portal-hot__empty h2 {
  margin: 0;
  font-size: 24px;
  color: var(--a-color-text);
}

.portal-hot__empty p {
  max-width: 480px;
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.portal-hot__fallback-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.portal-hot__fallback-links a {
  border: 1px solid var(--a-color-border);
  border-radius: 4px;
  padding: 6px 14px;
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 500;
  background: var(--a-color-bg);
  transition: all 0.2s ease;
}

.portal-hot__fallback-links a:hover {
  border-color: var(--a-color-text);
}

.portal-hot__card-skeleton {
  min-height: 180px;
  border-radius: var(--a-radius-card, 6px);
  background: var(--a-color-surface-muted);
}

/* ─── Responsive Adjustments ──────────────────────────── */
@media (max-width: 860px) {
  .portal-hot__hero {
    padding: 48px 16px 40px;
  }

  .portal-hot__hero-title {
    font-size: 32px;
  }

  .portal-hot__recommendation-grid,
  .portal-hot__loading-grid {
    grid-template-columns: 1fr;
  }

  .portal-hot__recommendation-card.has-image {
    grid-template-columns: 140px minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .portal-hot__container {
    padding: 32px 16px 0;
  }

  .portal-hot__hero-title {
    font-size: 26px;
  }

  .portal-hot__hero-subtitle {
    font-size: 14px;
  }

  .portal-hot__recommendation-card.has-image {
    grid-template-columns: 1fr;
  }

  .portal-hot__recommendation-image {
    aspect-ratio: 16 / 9;
  }

  .portal-hot__module-strip {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

