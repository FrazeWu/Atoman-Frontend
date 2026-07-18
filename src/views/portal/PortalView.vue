<template>
  <main class="portal-hot">
    <header class="portal-hot__header">
      <div>
        <p class="portal-hot__kicker">ATOMAN</p>
        <h1>推荐内容</h1>
      </div>
      <PButton variant="secondary" size="sm" :to="moduleUrl('feed')">进入订阅</PButton>
    </header>

    <section v-if="loading" class="portal-hot__loading" aria-label="热门内容加载中">
      <div class="portal-hot__loading-grid">
        <div v-for="index in 4" :key="index" class="portal-hot__card-skeleton a-skeleton" />
      </div>
    </section>

    <section v-else-if="error" class="portal-hot__empty">
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
      <section v-if="recommendationItems.length" class="portal-hot__recommendations" aria-label="推荐内容">
        <div class="portal-hot__recommendation-grid">
          <RouterLink
            v-for="item in recommendationItems"
            :key="`${item.module}-${item.id}`"
            :to="item.target_path"
            class="portal-hot__recommendation-card"
            :class="{ 'has-image': item.image_url }"
          >
            <div v-if="item.image_url" class="portal-hot__recommendation-image">
              <img :src="item.image_url" :alt="item.title" />
            </div>
            <div class="portal-hot__recommendation-body">
              <p class="portal-hot__meta">{{ moduleLabel(item.module) }} / {{ item.score_label }}</p>
              <h2>{{ item.title }}</h2>
              <p v-if="item.summary">{{ item.summary }}</p>
            </div>
          </RouterLink>
        </div>
      </section>

      <section class="portal-hot__sections" aria-label="模块热门内容">
        <article
          v-for="section in displaySections"
          :key="section.module"
          class="portal-hot__section"
        >
          <div class="portal-hot__section-head">
            <div>
              <p class="portal-hot__kicker">{{ moduleLabel(section.module) }}</p>
              <h2>{{ section.title }}</h2>
            </div>
            <RouterLink :to="moduleHomePath(section.module)" class="portal-hot__module-link">
              查看全部
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
                <img :src="item.image_url" :alt="item.title" />
              </div>
              <div class="portal-hot__card-body">
                <span>{{ item.score_label }}</span>
                <strong>{{ item.title }}</strong>
                <p v-if="item.summary">{{ item.summary }}</p>
              </div>
            </RouterLink>
          </div>
        </article>
      </section>

      <nav v-if="!displaySections.length" class="portal-hot__module-strip" aria-label="探索更多模块">
        <span>探索更多</span>
        <RouterLink
          v-for="room in otherRooms"
          :key="room.key"
          :to="moduleUrl(room.key)"
        >{{ room.name }}</RouterLink>
      </nav>
    </template>

    <section v-else class="portal-hot__empty">
      <p class="portal-hot__kicker">暂无内容</p>
      <h2>还没有可展示的热门内容</h2>
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
  padding: 48px 24px 96px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--a-color-surface-muted) 70%, transparent), transparent 340px),
    var(--a-color-bg);
}

.portal-hot__header,
.portal-hot__recommendations,
.portal-hot__sections,
.portal-hot__module-strip,
.portal-hot__loading,
.portal-hot__empty {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.portal-hot__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.portal-hot__header h1 {
  max-width: 760px;
  margin: 0;
  color: var(--a-color-text);
  font-size: 40px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.1;
}

.portal-hot__kicker {
  margin: 0 0 10px;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.portal-hot__recommendation-grid,
.portal-hot__loading-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.portal-hot__recommendations {
  margin-bottom: 40px;
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
  min-height: 154px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.portal-hot__recommendation-card.has-image {
  grid-template-columns: 140px minmax(0, 1fr);
}

.portal-hot__recommendation-image {
  background: var(--a-color-surface-muted);
  border-right: 1px solid var(--a-color-border-soft);
}

.portal-hot__recommendation-image img,
.portal-hot__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__recommendation-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  gap: 8px;
  padding: 20px;
}

.portal-hot__meta {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.portal-hot__recommendation-body h2,
.portal-hot__empty h2,
.portal-hot__section-head h2 {
  margin: 0;
  color: var(--a-color-text);
  letter-spacing: 0;
}

.portal-hot__recommendation-body h2 {
  font-size: 20px;
  line-height: 1.3;
}

.portal-hot__recommendation-body > p:last-child,
.portal-hot__empty p,
.portal-hot__card-body p {
  color: var(--a-color-text-secondary);
  line-height: 1.7;
}

.portal-hot__recommendation-body > p:last-child {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.portal-hot__card-body span {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.portal-hot__sections {
  display: grid;
  gap: 36px;
}

.portal-hot__module-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 18px;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 18px;
}

.portal-hot__module-strip span {
  color: var(--a-color-muted);
  font-size: 12px;
  font-weight: 500;
}

.portal-hot__module-strip a {
  color: var(--a-color-text);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.portal-hot__module-strip a:hover {
  text-decoration: underline;
}

.portal-hot__section {
  display: grid;
  gap: 16px;
}

.portal-hot__section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 12px;
}

.portal-hot__section-head h2 {
  font-size: 26px;
}

.portal-hot__module-link {
  flex-shrink: 0;
  color: var(--a-color-muted);
  font-size: 13px;
  font-weight: 500;
}

.portal-hot__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.portal-hot__card {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 210px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.portal-hot__thumb {
  aspect-ratio: 16 / 9;
  background: var(--a-color-surface-muted);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.portal-hot__card-body {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 16px;
}

.portal-hot__card-body strong {
  color: var(--a-color-text);
  font-size: 17px;
  line-height: 1.3;
}

.portal-hot__card-body p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.portal-hot__empty {
  display: grid;
  justify-items: start;
  gap: 14px;
  border: 1px solid var(--a-color-border);
  background: var(--a-color-bg);
  padding: 32px;
}

.portal-hot__empty h2 {
  font-size: 28px;
}

.portal-hot__empty p {
  max-width: 42rem;
  margin: 0;
}

.portal-hot__fallback-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.portal-hot__fallback-links a {
  border: 1px solid var(--a-color-border);
  padding: 8px 12px;
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 500;
}

.portal-hot__card-skeleton {
  min-height: 154px;
}

.portal-hot__recommendation-card:hover,
.portal-hot__card:hover,
.portal-hot__fallback-links a:hover {
  border-color: var(--a-color-text);
}

@media (max-width: 860px) {
  .portal-hot {
    padding: 32px 16px 80px;
  }

  .portal-hot__header,
  .portal-hot__section-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .portal-hot__recommendation-grid,
  .portal-hot__loading-grid {
    grid-template-columns: 1fr;
  }

  .portal-hot__header h1 {
    font-size: 32px;
  }
}

@media (max-width: 600px) {
  .portal-hot__recommendation-card {
    min-height: 120px;
  }

  .portal-hot__recommendation-card.has-image {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .portal-hot__recommendation-body {
    gap: 6px;
    padding: 14px 16px;
  }

  .portal-hot__recommendation-body h2 {
    font-size: 18px;
  }

  .portal-hot__recommendation-body > p:last-child {
    -webkit-line-clamp: 1;
  }
}
</style>
