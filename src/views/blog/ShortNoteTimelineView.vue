<template>
  <div class="a-page short-note-timeline">
    <PPageHeader title="短笺" />
    <div class="short-note-timeline__layout">
      <main class="short-note-timeline__stream">
        <ShortNoteComposer v-if="authStore.isAuthenticated" :key="composerKey" :initial-content="stagedInitialContent" compact :submitting="publishing" @submit="publish" />

        <div class="short-note-timeline__stream-bar">
          <span class="short-note-timeline__stream-label">最新动态</span>
        </div>

        <div v-if="selectedTag" class="short-note-timeline__filter-banner">
          <span class="short-note-timeline__filter-tag">正在筛选：#{{ selectedTag }}</span>
          <button type="button" class="short-note-timeline__filter-clear" @click="selectedTag = null">
            <X :size="12" aria-hidden="true" />
            <span>清除筛选</span>
          </button>
        </div>

        <div v-if="loading && !notes.length" class="short-note-timeline__loading">
          <div v-for="index in 3" :key="index" class="a-skeleton short-note-timeline__skeleton" />
        </div>
        <PEmpty v-else-if="!notes.length" title="还没有短笺" description="写下第一条短笺。" />
        <PEmpty v-else-if="!filteredNotes.length" title="没有匹配的短笺" description="换个话题看看吧。" />
        <TransitionGroup v-else name="note-push" tag="div" class="short-note-timeline__feed">
          <ShortNoteCard v-for="note in filteredNotes" :key="note.id" :note="note" @delete="remove" />
        </TransitionGroup>
        <p v-if="error" class="short-note-timeline__error" role="alert">{{ error }}</p>
        <div v-if="hasMore" ref="loadMoreSentinel" class="short-note-timeline__more">
          <PButton variant="secondary" :loading="loading" @click="loadMore">加载更多</PButton>
        </div>
      </main>

      <aside class="short-note-timeline__rail" aria-label="短笺推荐">
        <!-- 1. 热门速记话题 -->
        <section class="short-note-timeline__rail-section">
          <div class="short-note-timeline__rail-header">
            <h2>热门速记话题</h2>
            <span class="short-note-timeline__rail-tag">趋势</span>
          </div>
          <div class="short-note-timeline__topic-grid">
            <button
              v-for="tag in trendingTags"
              :key="tag.name"
              type="button"
              class="short-note-timeline__topic-pill"
              :class="{ 'is-active': selectedTag === tag.name }"
              @click="toggleTagFilter(tag.name)"
            >
              <span class="short-note-timeline__topic-hash">#</span>
              <span class="short-note-timeline__topic-name">{{ tag.name }}</span>
              <span v-if="tag.count" class="short-note-timeline__topic-count">{{ tag.count }}</span>
            </button>
          </div>
        </section>

        <!-- 3. 热门短笺 -->
        <section class="short-note-timeline__rail-section">
          <div class="short-note-timeline__rail-header">
            <h2>热门短笺</h2>
            <span class="short-note-timeline__rail-tag">精选</span>
          </div>
          <div class="short-note-timeline__rail-list">
            <button
              v-for="(note, index) in hotNotes"
              :key="note.id"
              type="button"
              class="short-note-timeline__hot-card"
              @click="openNoteSheet(note)"
            >
              <div class="short-note-timeline__hot-top">
                <span class="short-note-timeline__hot-rank" :class="`is-rank-${index + 1}`">0{{ index + 1 }}</span>
                <span class="short-note-timeline__hot-author">{{ note.user?.display_name || note.user?.username || '匿名用户' }}</span>
                <span class="short-note-timeline__hot-stat">
                  <Heart :size="11" aria-hidden="true" />
                  {{ note.likes_count }}
                </span>
              </div>
              <p class="short-note-timeline__hot-quote">{{ noteTitle(note) }}</p>
            </button>
          </div>
        </section>
      </aside>
    </div>
  </div>
  <PConfirm
    :show="deletePending !== null"
    title="删除短笺"
    message="确定删除这条短笺吗？"
    confirm-text="删除"
    danger
    :loading="deleting"
    @confirm="confirmRemove"
    @cancel="deletePending = null"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Heart, X } from 'lucide-vue-next'
import { apiRequestEnvelope, apiRequestResult } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import { formatDiscussionQuote, useDraftStagingStore } from '@/stores/draftStaging'
import type { ShortNote } from '@/types'

type ListMeta = { has_more?: boolean }
const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const draftStagingStore = useDraftStagingStore()
const stagedInitialContent = ref('')
const blogSheets = useBlogSheets()
const notes = ref<ShortNote[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const hasMore = ref(false)
const publishing = ref(false)
const composerKey = ref(0)
const deletePending = ref<ShortNote | null>(null)
const deleting = ref(false)
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

export interface RecommendedAuthor {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
  bio?: string
  noteCount: number
}

export interface TrendingTopic {
  name: string
  count?: number
}

const followedAuthorIds = ref<Set<string>>(new Set())

function isFollowing(id: string) {
  return followedAuthorIds.value.has(id)
}

async function loadFollowingState() {
  if (!authStore.isAuthenticated || !authStore.user?.uuid) return
  try {
    const response = await apiRequestResult<any>(api.users.following(authStore.user.uuid), {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok || !response.data) return
    const raw = response.data
    const list = Array.isArray(raw) ? raw : (raw.data || raw.items || [])
    const ids = new Set<string>()
    for (const item of list) {
      const u = item.uuid || item.id
      if (u) ids.add(String(u))
    }
    followedAuthorIds.value = ids
  } catch {
    // 忽略关系拉取异常，保留本地态
  }
}

async function toggleFollow(authorId: string) {
  if (!authStore.isAuthenticated) {
    void router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (authorId === authStore.user?.uuid) return

  const isCurrentlyFollowing = followedAuthorIds.value.has(authorId)
  if (isCurrentlyFollowing) {
    followedAuthorIds.value.delete(authorId)
  } else {
    followedAuthorIds.value.add(authorId)
  }

  try {
    const response = await apiRequestResult(api.users.follow(authorId), {
      method: isCurrentlyFollowing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) {
      if (isCurrentlyFollowing) {
        followedAuthorIds.value.add(authorId)
      } else {
        followedAuthorIds.value.delete(authorId)
      }
    }
  } catch {
    if (isCurrentlyFollowing) {
      followedAuthorIds.value.add(authorId)
    } else {
      followedAuthorIds.value.delete(authorId)
    }
  }
}

const recommendedAuthors = computed<RecommendedAuthor[]>(() => {
  const authorMap = new Map<string, RecommendedAuthor>()
  const myId = authStore.user?.uuid

  for (const note of notes.value) {
    const u = note.user
    const rawId = note.user_id || u?.id
    if (!rawId) continue
    const userId = String(rawId)
    if (myId && userId === myId) continue

    if (!authorMap.has(userId)) {
      authorMap.set(userId, {
        id: userId,
        username: u?.username || 'user',
        displayName: u?.display_name || u?.username || '速记创作者',
        avatarUrl: u?.avatar_url,
        bio: u?.bio || '',
        noteCount: 1,
      })
    } else {
      const existing = authorMap.get(userId)!
      existing.noteCount += 1
    }
  }

  const list = Array.from(authorMap.values()).sort((a, b) => b.noteCount - a.noteCount)
  if (list.length >= 3) return list.slice(0, 4)

  const fallbackAuthors: RecommendedAuthor[] = [
    { id: '019f567e-bc53-7785-9937-209dbbfe42ef', username: 'fazong', displayName: 'Fazong', bio: '设计系统与前端架构', noteCount: 6 },
    { id: '019f1864-6857-77af-9c40-def0af5a2ad4', username: 'fraze', displayName: 'Fraze', bio: 'Cupertino 体验思考', noteCount: 4 },
    { id: '019f5a01-0001-7000-8000-000000000009', username: 'solitude', displayName: 'Solitude', bio: '日常与灵感速记', noteCount: 3 },
  ]
  for (const fb of fallbackAuthors) {
    if (list.length >= 4) break
    if (myId && fb.id === myId) continue
    if (!list.some(a => a.id === fb.id || a.username === fb.username)) {
      list.push(fb)
    }
  }
  return list.slice(0, 4)
})

const selectedTag = ref<string | null>(null)
const backendTrendingTopics = ref<TrendingTopic[]>([])

async function loadTrendingTopics() {
  try {
    const res = await apiRequestEnvelope<TrendingTopic[]>(api.blog.shortNoteTrendingTopics)
    if (res?.data && Array.isArray(res.data)) {
      backendTrendingTopics.value = res.data
    }
  } catch {
    // 忽略异常，降级到本地短笺分析
  }
}

function toggleTagFilter(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

const trendingTags = computed<TrendingTopic[]>(() => {
  const list: TrendingTopic[] = [...backendTrendingTopics.value]
  const seen = new Set(list.map(t => t.name.toLowerCase()))

  const tagRegex = /#([\p{L}\p{N}_-]+)/gu
  for (const note of notes.value) {
    for (const m of note.content.matchAll(tagRegex)) {
      const raw = m[1].toLowerCase()
      if (!seen.has(raw)) {
        seen.add(raw)
        list.push({ name: m[1] })
        if (list.length >= 6) break
      }
    }
    if (list.length >= 6) break
  }

  const fallbackTags = ['设计规范', '音乐随笔', 'Cupertino', '灵感碎片', '日常记录']
  for (const ft of fallbackTags) {
    if (list.length >= 5) break
    if (!seen.has(ft.toLowerCase())) {
      seen.add(ft.toLowerCase())
      list.push({ name: ft })
    }
  }
  return list.slice(0, 5)
})

const filteredNotes = computed(() => {
  if (!selectedTag.value) return notes.value
  return notes.value.filter(n => n.content.includes(`#${selectedTag.value}`))
})

const hotNotes = computed(() => [...notes.value]
  .sort((left, right) => (right.likes_count + right.comments_count) - (left.likes_count + left.comments_count))
  .slice(0, 4))
const latestNotes = computed(() => notes.value.slice(0, 4))

function noteTitle(note: ShortNote) {
  return note.content.length > 42 ? `${note.content.slice(0, 42)}...` : note.content
}

function formatTime(val?: string) {
  if (!val) return ''
  const d = new Date(val)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function openNoteSheet(note: ShortNote) {
  blogSheets.openShortNote(note.id, noteTitle(note))
}

async function load(reset = false, requestedPage?: number) {
  if (loading.value) return false
  const targetPage = requestedPage ?? (reset ? 1 : page.value)
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, string> = {
      page: String(targetPage),
      page_size: '20',
    }
    if (selectedTag.value) {
      params.tag = selectedTag.value
    }
    const suffix = new URLSearchParams(params)
    const response = await apiRequestEnvelope<ShortNote[], ListMeta>(`${api.blog.shortNotes}?${suffix}`)
    notes.value = reset ? response.data : [...notes.value, ...response.data]
    page.value = targetPage
    hasMore.value = Boolean(response.meta?.has_more)
    return true
  } catch {
    error.value = '短笺加载失败，请重试'
    return false
  } finally {
    loading.value = false
  }
}
function loadMore() {
  if (loading.value || !hasMore.value) return
  void load(false, page.value + 1)
}

watch(selectedTag, () => {
  void load(true, 1)
})

function observeLoadMoreSentinel(target: HTMLElement | null) {
  loadMoreObserver?.disconnect()
  if (!target || typeof IntersectionObserver === 'undefined') return
  loadMoreObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadMore()
  }, { rootMargin: '320px 0px' })
  loadMoreObserver.observe(target)
}
async function publish(payload: { content: string; media_urls: string[] }) {
  if (!authStore.isAuthenticated) {
    void router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (publishing.value) return
  publishing.value = true
  error.value = ''
  try {
    const response = await apiRequestEnvelope<ShortNote>(api.blog.shortNotes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify(payload),
    })
    notes.value.unshift(response.data)
    stagedInitialContent.value = ''
    composerKey.value += 1
    void loadTrendingTopics()
  } catch {
    error.value = '发布失败，请重试'
  } finally {
    publishing.value = false
  }
}
async function remove(note: ShortNote) {
  if (deleting.value) return
  deletePending.value = note
}

async function confirmRemove() {
  const note = deletePending.value
  if (!note || deleting.value) return
  deleting.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(note.id), { method: 'DELETE', headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {} })
    notes.value = notes.value.filter(item => item.id !== note.id)
    void loadTrendingTopics()
  } catch { error.value = '删除失败，请重试' }
  finally {
    deleting.value = false
    deletePending.value = null
  }
}
onMounted(() => {
  const staged = draftStagingStore.consumePendingQuote('short_note')
  if (staged) {
    stagedInitialContent.value = formatDiscussionQuote(staged).content
  }
  void load()
  void loadTrendingTopics()
  void loadFollowingState()
})
watch(() => authStore.isAuthenticated, () => {
  void loadFollowingState()
})
watch(loadMoreSentinel, observeLoadMoreSentinel)
onBeforeUnmount(() => loadMoreObserver?.disconnect())
</script>

<style scoped>
.short-note-timeline {
  width: 100%;
  padding-top: 1.5rem;
  padding-bottom: 3rem;
}

.short-note-timeline__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--a-recommendation-width);
  gap: var(--a-content-column-gap);
  align-items: start;
  margin-top: 1rem;
}

.short-note-timeline__stream {
  min-width: 0;
}

.short-note-timeline__feed {
  display: flex;
  flex-direction: column;
}

/* 发布新短笺时向下推出动效 */
.note-push-enter-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.note-push-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.note-push-enter-from {
  opacity: 0;
  transform: translateY(-24px);
}

.note-push-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.note-push-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

.note-push-move {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.short-note-timeline__feed > :deep(*) {
  content-visibility: auto;
  contain-intrinsic-size: 0 160px;
}

.short-note-timeline__feed > :deep(.sticky-memo-card:first-child) {
  border-top: none;
}

.short-note-timeline__skeleton {
  height: 10rem;
  border-radius: var(--a-radius-card);
  margin-bottom: 1rem;
}

.short-note-timeline__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.short-note-timeline__rail-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: transparent;
  border: none;
  box-shadow: none;
}

.short-note-timeline__rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
}

.short-note-timeline__rail-header h2 {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--a-color-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.short-note-timeline__rail-tag {
  font-size: 0.65rem;
  font-weight: 700;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.1rem 0.35rem;
  border-radius: var(--a-radius-control);
}

.short-note-timeline__rail-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.short-note-timeline__hot-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.short-note-timeline__hot-card:hover,
.short-note-timeline__hot-card:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.short-note-timeline__hot-card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

.short-note-timeline__hot-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.short-note-timeline__hot-rank {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-muted);
}

.short-note-timeline__hot-rank.is-rank-1 {
  color: var(--a-color-warning);
}

.short-note-timeline__hot-author {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--a-color-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.short-note-timeline__hot-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.short-note-timeline__hot-quote {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--a-color-fg);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}


/* 热门话题 Pill 网格 */
.short-note-timeline__topic-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.1rem 0.4rem;
}

.short-note-timeline__topic-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  height: 26px;
  padding: 0 0.55rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.short-note-timeline__topic-pill:hover {
  background: var(--a-color-surface);
  border-color: var(--a-color-border-hover);
}

.short-note-timeline__topic-pill.is-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}

.short-note-timeline__topic-hash {
  color: var(--a-color-muted);
  font-weight: 600;
}

.short-note-timeline__topic-pill.is-active .short-note-timeline__topic-hash {
  color: var(--a-color-bg);
  opacity: 0.8;
}

.short-note-timeline__topic-count {
  font-size: 0.68rem;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-muted);
  margin-left: 0.15rem;
}

.short-note-timeline__topic-pill.is-active .short-note-timeline__topic-count {
  color: var(--a-color-bg);
  opacity: 0.8;
}

/* 筛选横条 */
.short-note-timeline__filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
}

.short-note-timeline__filter-tag {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.short-note-timeline__filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}

.short-note-timeline__filter-clear:hover {
  color: var(--a-color-fg);
}

/* 主流顶部的最新动态标头 */
.short-note-timeline__stream-bar {
  display: flex;
  align-items: center;
  padding: 0.65rem 0.25rem 0.25rem;
}

.short-note-timeline__stream-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.short-note-timeline__loading {
  display: grid;
  gap: 1rem;
}

.short-note-timeline__more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.short-note-timeline__error {
  color: var(--a-color-danger);
  font-size: 0.875rem;
}

@media (max-width: 1199px) {
  .short-note-timeline__layout {
    display: block;
  }
  .short-note-timeline__rail {
    display: none;
  }
}
</style>
