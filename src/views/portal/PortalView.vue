<template>
  <main class="portal-hot">
    <header class="portal-hot__hero">
      <div class="portal-hot__hero-content">
        <div class="portal-hot__hero-badge">
          <span class="portal-hot__badge-dot" />
          <span>ATOMAN</span>
        </div>
        <h1 class="portal-hot__hero-title">
          内容聚合
        </h1>
        <p class="portal-hot__hero-subtitle">
          探索全站精选与最新动态
        </p>
        <div class="portal-hot__hero-actions">
          <PButton variant="primary" size="md" :to="modulePathUrl('feed', '/explore')">
            浏览今日精选
          </PButton>
          <a href="#sections" class="portal-hot__secondary-btn">
            浏览模块内容
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
          <section class="portal-hot__sections portal-hot__loading-sections" aria-hidden="true">
            <article
              v-for="module in loadingModules"
              :key="module"
              :class="[
                'portal-hot__section',
                'portal-hot__loading-section',
                `portal-hot__loading-section--${module}`,
                `portal-hot__section--${module}`,
              ]"
            >
              <div class="portal-hot__section-head">
                <h2>{{ moduleLabel(module) }}</h2>
                <span class="portal-hot__module-link">查看全部 <span aria-hidden="true">→</span></span>
              </div>
              <div
                :class="[
                  'portal-hot__section-placeholder',
                  `portal-hot__section-placeholder--${module}`,
                ]"
              />
            </article>
          </section>
        </template>

        <template v-if="hasContent">
          <!-- 2. 分模块热门内容 (Sections) -->
          <section class="portal-hot__sections" aria-label="模块热门内容">
            <article
              v-for="section in displaySections"
              :key="section.module"
              :ref="(element) => registerSection(element, section.module)"
              :class="['portal-hot__section', `portal-hot__section--${section.module}`]"
            >
              <div class="portal-hot__section-head">
                <h2>{{ moduleLabel(section.module) }}</h2>
                <RouterLink :to="moduleHomePath(section.module)" class="portal-hot__module-link">
                  <span>查看全部</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </RouterLink>
              </div>

              <div
                v-if="isSectionReady(section.module)"
                class="portal-hot__section-body"
              >
              <!-- 🎵 音乐专区：直接引用现有 MusicAlbumCard 组件 -->
              <div v-if="section.module === 'music'" class="portal-hot__music-grid">
                <div
                  v-for="item in section.items"
                  :key="item.id"
                  class="portal-hot__music-wrap"
                  :class="{ 'portal-hot__thumb': item.image_url }"
                >
                  <MusicAlbumCard
                    :album="{
                      id: item.id,
                      title: item.title,
                      summary: item.summary,
                      image_url: item.image_url,
                      cover_url: item.image_url,
                      target_path: item.target_path,
                      artists: item.artists,
                      play_count: item.play_count,
                      bookmark_count: item.bookmark_count,
                      year: extractYear(item.published_at),
                      release_date: item.published_at
                    }"
                    :priority="isPriorityImage(item)"
                    :show-bookmark="false"
                    @click="router.push(item.target_path)"
                  />
                </div>
              </div>

              <!-- 🎬 视频专区：直接引用现有 PVideoCard 组件 -->
              <div v-else-if="section.module === 'video'" class="portal-hot__video-grid">
                <div
                  v-for="item in section.items"
                  :key="item.id"
                  class="portal-hot__video-wrap"
                  :class="{ 'portal-hot__thumb': item.image_url }"
                >
                  <PVideoCard
                    :video="({
                      id: item.id,
                      title: item.title,
                      thumbnail_url: item.image_url,
                      view_count: Math.round(item.score || 0),
                      created_at: item.published_at || '',
                      channel: { id: item.id, name: item.summary || '创作者' }
                    } as unknown as Video)"
                    :to="item.target_path"
                    :priority="isPriorityImage(item)"
                  />
                </div>
              </div>

              <!-- 📰 热门文章 (Blog) 与 📡 订阅热读 (Feed) 及讨论：采用标准 .feed-timeline-box + BlogItemCard / PContentCard 流式卡片 -->
              <div v-else class="feed-timeline-box">
                <RouterLink
                  v-for="item in section.items"
                  :key="`${section.module}-${item.id}`"
                  :to="item.target_path"
                  class="portal-hot__card-link"
                >
                  <BlogItemCard
                    v-if="section.module === 'blog'"
                    :item="{
                      id: item.id,
                      title: item.title,
                      summary: item.summary,
                      cover_url: item.image_url,
                      created_at: item.published_at,
                      view_count: Math.round(item.score || 0),
                      source: 'post',
                      targetPath: item.target_path,
                      user: {
                        display_name: item.author_name,
                        username: item.author_username,
                        avatar_url: item.author_avatar_url || item.source_image_url,
                      },
                    }"
                    type="post"
                  />

                  <BlogItemCard
                    v-else-if="section.module === 'feed'"
                    :item="{
                      id: item.id,
                      title: item.title,
                      summary: item.summary,
                      image_url: item.image_url,
                      created_at: item.published_at,
                      read_count: Math.round(item.score || 0),
                      source: 'feed',
                      targetPath: item.target_path,
                      feed_source: {
                        title: item.source_name,
                        cover_url: item.source_image_url,
                      },
                    }"
                    type="feed_item"
                  />

                  <div v-else-if="section.module === 'debate'" class="content-stream-entry portal-hot__debate-card">
                    <div class="portal-hot__debate-meta">
                      <span class="portal-hot__tag portal-hot__tag--debate">辩论</span>
                      <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                      <span v-if="item.published_at" class="portal-hot__date">{{ formatDate(item.published_at) }}</span>
                    </div>
                    <h3 class="portal-hot__debate-title">{{ item.title }}</h3>
                    <p v-if="item.summary" class="portal-hot__debate-summary">{{ item.summary }}</p>
                    
                    <!-- 双色立场对比条 -->
                    <div class="portal-hot__stance-wrap" aria-hidden="true">
                      <div class="portal-hot__stance-bar">
                        <div class="portal-hot__stance-pro" />
                        <div class="portal-hot__stance-con" />
                      </div>
                      <div class="portal-hot__stance-info">
                        <span class="portal-hot__stance-badge portal-hot__stance-badge--pro">正方观点</span>
                        <span class="portal-hot__stance-action">参与讨论 ›</span>
                        <span class="portal-hot__stance-badge portal-hot__stance-badge--con">反方观点</span>
                      </div>
                    </div>
                  </div>

                  <PContentCard
                    v-else
                    :title="item.title"
                    :summary="item.summary"
                    class="content-stream-entry portal-hot__card"
                  >
                    <template #meta>
                      <span class="portal-hot__tag">{{ moduleLabel(section.module) }}</span>
                      <span v-if="item.score_label" class="portal-hot__score">{{ item.score_label }}</span>
                      <span v-if="item.published_at" class="portal-hot__date">{{ formatDate(item.published_at) }}</span>
                    </template>
                  </PContentCard>
                </RouterLink>
              </div>
              </div>
              <div
                v-else
                :class="[
                  'portal-hot__section-placeholder',
                  `portal-hot__section-placeholder--${section.module}`,
                ]"
                aria-hidden="true"
              />
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
import { computed, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { apiRequestResult } from '@/api/client'

import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PButton from '@/components/ui/PButton.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'
import { useApiUrl } from '@/composables/useApiUrl'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { Video } from '@/types'

interface PortalMusicArtist {
  id: string
  name: string
}

interface PortalHotItem {
  id: string
  module: string
  kind: string
  title: string
  summary: string
  image_url: string
  artists?: PortalMusicArtist[]
  play_count?: number
  bookmark_count?: number
  author_name?: string
  author_username?: string
  author_avatar_url?: string
  source_name?: string
  source_image_url?: string
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

const apiUrl = useApiUrl()
const router = useRouter()
const siteAccessStore = useSiteAccessStore()

const loading = ref(true)
const error = ref('')
const hotContent = ref<PortalHotResponse>({ featured: [], sections: [] })
const sectionItemLimit = 4
const homeModuleOrder: ModuleRoomKey[] = ['blog', 'feed', 'music', 'video', 'debate']
const readySections = ref(new Set<string>())
const sectionElements = new Map<Element, string>()
let sectionObserver: IntersectionObserver | null = null

function handleSectionIntersect(entries: IntersectionObserverEntry[]) {
  const nextReadySections = new Set(readySections.value)

  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    const module = sectionElements.get(entry.target)
    if (!module) continue

    nextReadySections.add(module)
    sectionObserver?.unobserve(entry.target)
  }

  if (nextReadySections.size !== readySections.value.size) {
    readySections.value = nextReadySections
  }
}

function registerSection(element: Element | ComponentPublicInstance | null, module: string) {
  if (!element || !sectionObserver || !('nodeType' in element)) return
  const target = element as Element
  sectionElements.set(target, module)
  sectionObserver.observe(target)
}

function isSectionReady(module: string) {
  return !sectionObserver || readySections.value.has(module)
}

if (typeof IntersectionObserver !== 'undefined') {
  sectionObserver = new IntersectionObserver(handleSectionIntersect, {
    rootMargin: '300px 0px',
  })
}

const visibleRooms = computed(() => (
  moduleNavOrder
    .filter((key) => siteAccessStore.isModuleVisible(key))
    .map((key) => moduleRooms[key])
))

const loadingModules = computed(() => homeModuleOrder.filter((module) => siteAccessStore.isModuleVisible(module)))

const combinedSections = computed<PortalHotSection[]>(() => {
  const sections = hotContent.value.sections.map((section) => ({
    ...section,
    items: [...section.items],
  }))
  for (const item of hotContent.value.featured) {
    if (!isModuleRoomKey(item.module)) continue
    let section = sections.find((candidate) => candidate.module === item.module)
    if (!section) {
      section = { module: item.module, title: moduleLabel(item.module), items: [] }
      sections.push(section)
    }
    if (!section.items.some((candidate) => candidate.id === item.id)) {
      section.items.unshift(item)
    }
  }
  return sections
})

const visibleSections = computed(() => (
  combinedSections.value.filter((section) => (
    isModuleRoomKey(section.module) && siteAccessStore.isModuleVisible(section.module)
  ))
))

const displaySections = computed(() => visibleSections.value
  .map((section) => ({
    ...section,
    items: section.items.slice(0, sectionItemLimit),
  }))
  .filter((section) => section.items.length > 0)
  .sort((left, right) => modulePriority(left.module) - modulePriority(right.module)))
const priorityImageKey = computed(() => {
  const item = displaySections.value.flatMap((section) => section.items).find((candidate) => candidate.image_url)
  return item ? `${item.module}:${item.id}` : ''
})
const otherRooms = computed(() => visibleRooms.value)
const hasContent = computed(() => displaySections.value.length > 0)

async function loadHotContent() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiRequestResult(`${apiUrl}/portal/hot?limit=6&spotlight_offset=0`, {
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
    const message = err instanceof Error ? err.message : '未知错误'
    error.value = message
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

function modulePriority(module: string) {
  if (!isModuleRoomKey(module)) return homeModuleOrder.length
  const index = homeModuleOrder.indexOf(module)
  return index === -1 ? homeModuleOrder.length : index
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

function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined
  try {
    const d = new Date(dateStr)
    const y = d.getFullYear()
    return isNaN(y) ? undefined : y
  } catch {
    return undefined
  }
}

onMounted(() => {
  void loadHotContent()
})

onBeforeUnmount(() => {
  sectionObserver?.disconnect()
  sectionObserver = null
  sectionElements.clear()
})
</script>

<style scoped>
@import "./portalView.css";

.portal-hot__tag.portal-hot__tag--debate {
  background: color-mix(in srgb, var(--a-color-primary) 10%, transparent);
  color: var(--a-color-primary);
}

.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.portal-hot__section-placeholder {
  min-height: 22rem;
}

.portal-hot__section-placeholder--blog {
  min-height: 30.625rem;
}

.portal-hot__section--blog > .portal-hot__section-body,
.portal-hot__section-placeholder--blog {
  min-height: 30.625rem;
}

.portal-hot__section-placeholder--feed {
  min-height: 30.625rem;
}

.portal-hot__section--feed > .portal-hot__section-body,
.portal-hot__section-placeholder--feed {
  min-height: 30.625rem;
}

.portal-hot__section-placeholder--music {
  min-height: 16.625rem;
}

.portal-hot__section--music > .portal-hot__section-body,
.portal-hot__section-placeholder--music {
  min-height: 16.625rem;
}

.portal-hot__section-placeholder--video {
  min-height: 37.875rem;
}

.portal-hot__section--video > .portal-hot__section-body,
.portal-hot__section-placeholder--video {
  min-height: 37.875rem;
}

.portal-hot__section-placeholder--debate {
  min-height: 9.8125rem;
}

.portal-hot__section--debate > .portal-hot__section-body,
.portal-hot__section-placeholder--debate {
  min-height: 9.8125rem;
}

@media (max-width: 720px) {
  .portal-hot__section-placeholder--blog {
    min-height: 49.4375rem;
  }

  .portal-hot__section--blog > .portal-hot__section-body,
  .portal-hot__section-placeholder--blog {
    min-height: 49.4375rem;
  }

  .portal-hot__section-placeholder--feed {
    min-height: 46.75rem;
  }

  .portal-hot__section--feed > .portal-hot__section-body,
  .portal-hot__section-placeholder--feed {
    min-height: 46.75rem;
  }

  .portal-hot__section-placeholder--music {
    min-height: 28.875rem;
  }

  .portal-hot__section--music > .portal-hot__section-body,
  .portal-hot__section-placeholder--music {
    min-height: 28.875rem;
  }

  .portal-hot__section-placeholder--video {
    min-height: 74.3125rem;
  }

  .portal-hot__section--video > .portal-hot__section-body,
  .portal-hot__section-placeholder--video {
    min-height: 74.3125rem;
  }

  .portal-hot__section-placeholder--debate {
    min-height: 9.8125rem;
  }

  .portal-hot__section--debate > .portal-hot__section-body,
  .portal-hot__section-placeholder--debate {
    min-height: 9.8125rem;
  }
}
</style>
