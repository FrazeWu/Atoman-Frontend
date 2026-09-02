<template>
  <main class="portal-hot">
    <header class="portal-hot__hero">
      <div class="portal-hot__hero-content">
        <div>
          <h1 class="portal-hot__hero-title">从全站挑出的内容</h1>
          <p class="portal-hot__hero-subtitle">优先呈现正在发生、值得阅读和跨领域可探索的高质量内容。</p>
        </div>
      </div>
    </header>

    <div class="portal-hot__container">
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
          <!-- 2. 分模块热门内容 (Sections) -->
          <section class="portal-hot__sections" aria-label="模块热门内容">
            <article
              v-for="section in displaySections"
              :key="section.module"
              class="portal-hot__section"
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
import { RouterLink, useRouter } from 'vue-router'
import { apiRequestResult } from '@/api/client'

import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApi } from '@/composables/useApi'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { moduleUrl } from '@/router/siteUrls'
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

const api = useApi()
const router = useRouter()
const siteAccessStore = useSiteAccessStore()

const loading = ref(true)
const error = ref('')
const hotContent = ref<PortalHotResponse>({ featured: [], sections: [] })
const sectionItemLimit = 4
const homeModuleOrder = ['blog', 'feed', 'music', 'video', 'debate']

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
    const response = await apiRequestResult(`${api.url}/portal/hot?limit=6&spotlight_offset=0`, {
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
  padding: 1.25rem 1.5rem;
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

/* ─── 辩题专属卡片 ──────────────────────────────────── */
.portal-hot__debate-card {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.portal-hot__debate-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.portal-hot__tag--debate {
  background: color-mix(in srgb, #6366f1 10%, transparent);
  color: #6366f1;
}

.portal-hot__debate-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-fg);
  line-height: 1.4;
}

.portal-hot__debate-summary {
  margin: 0;
  font-size: 0.84rem;
  color: var(--a-color-muted);
  line-height: 1.5;
}

.portal-hot__stance-wrap {
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.portal-hot__stance-bar {
  display: flex;
  height: 6px;
  width: 100%;
  border-radius: var(--a-radius-pill, 999px);
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.portal-hot__stance-pro {
  width: 58%;
  background: #3b82f6;
}

.portal-hot__stance-con {
  width: 42%;
  background: #ef4444;
}

.portal-hot__stance-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
}

.portal-hot__stance-badge--pro {
  color: #3b82f6;
  font-weight: 500;
}

.portal-hot__stance-badge--con {
  color: #ef4444;
  font-weight: 500;
}

.portal-hot__stance-action {
  color: var(--a-color-muted);
  font-size: 0.75rem;
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

.portal-hot__card-link {
  display: block;
  color: inherit;
  text-decoration: none;
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
}

.portal-hot__section-head h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
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

/* 🎵 音乐专区：现有 MusicAlbumCard 网格 */
.portal-hot__music-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.25rem;
}

/* 🎬 视频专区：现有 PVideoCard 网格 */
.portal-hot__video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

/* 📰 标准流式容器与条目 */
.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

/* 居中未读小短竖线 */
.portal-stream-unread-bar {
  display: block;
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: #10b981;
  margin-top: 0.2rem;
  flex-shrink: 0;
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

  .portal-hot__container {
    padding: 1.5rem 1rem 0;
  }

  .portal-hot__music-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .portal-hot__video-grid {
    grid-template-columns: 1fr;
  }
}
</style>
