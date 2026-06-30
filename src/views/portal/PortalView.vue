<template>
  <main class="portal-hot">
    <header class="portal-hot__header">
      <div>
        <p class="portal-hot__kicker">ATOMAN</p>
        <h1>正在发生的内容</h1>
      </div>
      <PButton variant="secondary" size="sm" :to="moduleUrl('feed')">进入订阅</PButton>
    </header>

    <section v-if="loading" class="portal-hot__loading" aria-label="热门内容加载中">
      <div class="portal-hot__lead-skeleton a-skeleton" />
      <div class="portal-hot__rail">
        <div v-for="index in 3" :key="index" class="portal-hot__card-skeleton a-skeleton" />
      </div>
    </section>

    <section v-else-if="error" class="portal-hot__empty">
      <p class="portal-hot__kicker">LOAD FAILED</p>
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
      <section v-if="leadItem" class="portal-hot__featured" aria-label="全站热门">
        <RouterLink :to="leadItem.target_path" class="portal-hot__lead">
          <div v-if="leadItem.image_url" class="portal-hot__lead-image">
            <img :src="leadItem.image_url" :alt="leadItem.title" />
          </div>
          <div class="portal-hot__lead-body">
            <p class="portal-hot__meta">{{ moduleLabel(leadItem.module) }} / {{ leadItem.score_label }}</p>
            <h2>{{ leadItem.title }}</h2>
            <p v-if="leadItem.summary">{{ leadItem.summary }}</p>
          </div>
        </RouterLink>

        <div v-if="secondaryFeatured.length" class="portal-hot__side-list">
          <RouterLink
            v-for="item in secondaryFeatured"
            :key="`${item.module}-${item.id}`"
            :to="item.target_path"
            class="portal-hot__side-item"
          >
            <span>{{ moduleLabel(item.module) }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.score_label }}</small>
          </RouterLink>
        </div>
      </section>

      <section class="portal-hot__sections" aria-label="模块热门内容">
        <article
          v-for="section in visibleSections"
          :key="section.module"
          class="portal-hot__section"
        >
          <div class="portal-hot__section-head">
            <div>
              <p class="portal-hot__kicker">{{ section.module.toUpperCase() }}</p>
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
    </template>

    <section v-else class="portal-hot__empty">
      <p class="portal-hot__kicker">EMPTY</p>
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

const visibleModuleKeys = computed(() => new Set(visibleRooms.value.map((room) => room.key)))

const visibleSections = computed(() => (
  hotContent.value.sections.filter((section) => (
    isModuleRoomKey(section.module) && visibleModuleKeys.value.has(section.module)
  ))
))

const visibleFeatured = computed(() => (
  hotContent.value.featured.filter((item) => (
    isModuleRoomKey(item.module) && visibleModuleKeys.value.has(item.module)
  ))
))

const leadItem = computed(() => visibleFeatured.value[0])
const secondaryFeatured = computed(() => visibleFeatured.value.slice(1, 4))
const hasContent = computed(() => visibleFeatured.value.length > 0 || visibleSections.value.length > 0)

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
    linear-gradient(180deg, color-mix(in srgb, var(--a-color-paper-wash) 70%, transparent), transparent 340px),
    var(--a-color-bg);
}

.portal-hot__header,
.portal-hot__featured,
.portal-hot__sections,
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
  color: var(--a-color-ink);
  font-size: clamp(36px, 7vw, 82px);
  font-weight: 950;
  letter-spacing: 0;
  line-height: 0.95;
}

.portal-hot__kicker {
  margin: 0 0 10px;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.portal-hot__featured {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.8fr);
  gap: 18px;
  margin-bottom: 40px;
}

.portal-hot__lead,
.portal-hot__side-item,
.portal-hot__card,
.portal-hot__module-link,
.portal-hot__fallback-links a {
  color: inherit;
  text-decoration: none;
}

.portal-hot__lead {
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1fr);
  min-height: 360px;
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
}

.portal-hot__lead-image {
  min-height: 100%;
  background: var(--a-color-paper-wash);
}

.portal-hot__lead-image img,
.portal-hot__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portal-hot__lead-body {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 14px;
  padding: 32px;
}

.portal-hot__meta {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.portal-hot__lead-body h2,
.portal-hot__empty h2,
.portal-hot__section-head h2 {
  margin: 0;
  color: var(--a-color-ink);
  letter-spacing: 0;
}

.portal-hot__lead-body h2 {
  font-size: clamp(28px, 4vw, 52px);
  line-height: 1;
}

.portal-hot__lead-body p,
.portal-hot__empty p,
.portal-hot__card-body p {
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}

.portal-hot__lead-body p {
  margin: 0;
  max-width: 48rem;
}

.portal-hot__side-list {
  display: grid;
  gap: 12px;
}

.portal-hot__side-item {
  display: grid;
  align-content: space-between;
  gap: 12px;
  min-height: 112px;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  padding: 18px;
}

.portal-hot__side-item span,
.portal-hot__side-item small,
.portal-hot__card-body span {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.portal-hot__side-item strong {
  color: var(--a-color-ink);
  font-size: 18px;
  line-height: 1.25;
}

.portal-hot__sections {
  display: grid;
  gap: 36px;
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
  border-bottom: 1px solid var(--a-color-line-soft);
  padding-bottom: 12px;
}

.portal-hot__section-head h2 {
  font-size: 26px;
}

.portal-hot__module-link {
  flex-shrink: 0;
  color: var(--a-color-ink-soft);
  font-size: 13px;
  font-weight: 800;
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.portal-hot__thumb {
  aspect-ratio: 16 / 9;
  background: var(--a-color-paper-wash);
  border-bottom: 1px solid var(--a-color-line-soft);
}

.portal-hot__card-body {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 16px;
}

.portal-hot__card-body strong {
  color: var(--a-color-ink);
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
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
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
  border: 1px solid var(--a-color-line);
  padding: 8px 12px;
  color: var(--a-color-ink);
  font-size: 13px;
  font-weight: 800;
}

.portal-hot__rail {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 16px;
}

.portal-hot__lead-skeleton {
  min-height: 360px;
}

.portal-hot__card-skeleton {
  min-height: 160px;
}

.portal-hot__lead:hover,
.portal-hot__side-item:hover,
.portal-hot__card:hover,
.portal-hot__fallback-links a:hover {
  border-color: var(--a-color-ink);
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

  .portal-hot__featured,
  .portal-hot__lead {
    grid-template-columns: 1fr;
  }

  .portal-hot__lead {
    min-height: auto;
  }

  .portal-hot__lead-image {
    aspect-ratio: 16 / 10;
  }

  .portal-hot__lead-body {
    padding: 22px;
  }

  .portal-hot__rail {
    grid-template-columns: 1fr;
  }
}
</style>
