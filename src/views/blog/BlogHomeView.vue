<template>
  <div class="a-page blog-home">
    <PPageHeader title="发现" accent>
      <template #action>
        <PButton v-if="!authStore.isAuthenticated" to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <ContentContinueSection module="blog" />

    <!-- 筛选控制栏 -->
    <div class="blog-home__filters" aria-label="文章筛选">
      <div class="blog-home__filter-group">
        <PSegmentedControl
          v-model="typeFilter"
          :options="typeOptions"
          @change="selectType"
        />
      </div>
      <div class="blog-home__filter-group">
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="selectRecommendationMode"
        />
      </div>
      <div class="blog-home__filter-group blog-home__filter-group--end">
        <PSegmentedControl
          v-model="sortBy"
          :options="sortOptions"
          @change="selectSort"
        />
      </div>
    </div>

    <!-- 生产环境 Stream + Sticky Rail 主布局 -->
    <div class="blog-home__layout">
      <!-- 左侧内容流 Stream -->
      <main class="blog-home__stream">

        <!-- 主文章列表流 -->
        <div v-if="isStreamLoading && !streamItems.length" class="blog-home__skeleton-list">
          <div v-for="i in 5" :key="i" class="a-skeleton" style="height: 8rem; border-radius: var(--a-radius-card);" />
        </div>

        <PEmpty v-else-if="!streamItems.length" title="暂无内容" description="还没有发布任何内容" />

        <div v-else class="blog-home__feed">
          <template v-for="streamItem in streamItems" :key="streamItem.key">
            <BlogItemCard
              v-if="streamItem.kind === 'post'"
              :item="streamItem.post"
              type="post"
              :bookmarked="isBookmarked(streamItem.post)"
              :in-reading-list="isReadingList(streamItem.post)"
              :starred="isStarred(streamItem.post)"
              @click="openPost(streamItem.post)"
              @toggle-bookmark="toggleBookmark(streamItem.post)"
              @toggle-reading-list="toggleReadingList(streamItem.post)"
              @toggle-star="toggleStar(streamItem.post)"
            />
            <ShortNoteCard
              v-else
              :note="streamItem.note"
              @delete="pendingDeleteNote = streamItem.note"
            />
          </template>
        </div>

        <PButton
          v-if="hasMore"
          block
          outline
          :loading="loading"
          style="margin-top: 1rem"
          @click="loadMore"
        >
          加载更多
        </PButton>
      </main>

      <!-- 右侧智能推荐 Sticky Rail -->
      <aside class="blog-home__rail" aria-label="侧边推荐">
        <!-- 热门频道卡片 -->
        <section v-if="channels.length" class="blog-home__rail-section">
          <div class="blog-home__rail-header">
            <Flame :size="16" class="blog-home__rail-icon is-hot" />
            <h2>热门频道</h2>
          </div>
          <div class="blog-home__rail-list">
            <BlogEntityCard
              v-for="ch in channels.slice(0, 5)"
              :key="ch.id"
              kind="channel"
              :title="ch.name"
              :cover-url="ch.cover_url"
              :description="ch.description"
              compact
              :show-subscribe="false"
              @select="openChannel(ch)"
            />
          </div>
        </section>

        <!-- 推荐精选必读 -->
        <section v-if="recommendedPosts.length > 3" class="blog-home__rail-section">
          <div class="blog-home__rail-header">
            <Sparkles :size="16" class="blog-home__rail-icon is-sparkles" />
            <h2>精选推荐文章</h2>
          </div>
          <div class="blog-home__rail-list">
            <div
              v-for="item in recommendedPosts.slice(3, 8)"
              :key="item.id"
              class="blog-home__rail-note"
              @click="openRecommendedPost(item)"
            >
              <strong class="blog-home__rail-title">{{ item.title }}</strong>
              <span v-if="item.score_label" class="blog-home__rail-sub">{{ item.score_label }}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
  <PConfirm
    :show="pendingDeleteNote !== null"
    title="删除短话"
    message="确定删除这条短话吗？"
    confirm-text="删除"
    cancel-text="取消"
    danger
    :loading="deletingNote"
    @confirm="deletePendingNote"
    @cancel="pendingDeleteNote = null"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, Clock, Flame, Sparkles, Star } from 'lucide-vue-next'

import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import BlogEntityCard from '@/components/blog/BlogEntityCard.vue'
import EntryActions from '@/components/shared/EntryActions.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PClip from '@/components/ui/PClip.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'

import { apiRequestEnvelope, apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { reportError } from '@/utils/logger'
import type { Post, ShortNote } from '@/types'

defineOptions({ name: 'BlogHomeView' })

interface BlogChannel {
  id: string | number
  name: string
  slug?: string
  description?: string
  cover_url?: string
}

interface BlogHomeListItem {
  id: string
  title: string
  summary?: string
  cover_url?: string
  created_at?: string
  view_count?: number
  rating_score?: number
  rating_count?: number
  bookmarks_count?: number
  likes_count?: number
  comments_count?: number
  channel?: BlogChannel
  user?: {
    username?: string
    display_name?: string
    avatar_url?: string
  }
  source: 'post' | 'feed'
  targetPath: string
}

interface RecommendationPayload {
  id: string
  title: string
  summary?: string
  image_url?: string
  target_path?: string
  score_label?: string
  view_count?: number
  read_count?: number
  rating_score?: number
  rating_count?: number
  bookmark_count?: number
  post?: BlogHomeListItem
}

type BlogHomeStreamItem =
  | { kind: 'post'; key: string; timestamp?: string; post: BlogHomeListItem }
  | { kind: 'note'; key: string; timestamp?: string; note: ShortNote }


const PAGE_SIZE = 20
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const blogSheets = useBlogSheets()
const api = useApi()

const posts = ref<BlogHomeListItem[]>([])
const shortNotes = ref<ShortNote[]>([])
const notesLoading = ref(false)
const pendingDeleteNote = ref<ShortNote | null>(null)
const deletingNote = ref(false)
const recommendedPosts = ref<Array<{
  id: string
  title: string
  summary: string
  image_url: string
  targetPath: string
  score_label: string
}>>([])
const channels = ref<BlogChannel[]>([])
const loading = ref(true)
const recommendationLoading = ref(false)
const page = ref(1)
const hasMore = ref(false)
const typeFilter = ref<'all' | 'post' | 'note'>('all')
const sortBy = ref('latest')
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const activeQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')
let postsRequestSequence = 0

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '文章', value: 'post' },
  { label: '短话', value: 'note' },
]

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'popular' },
]

const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const isStreamLoading = computed(() => loading.value || notesLoading.value)
const streamItems = computed<BlogHomeStreamItem[]>(() => {
  const postItems: BlogHomeStreamItem[] = typeFilter.value === 'note'
    ? []
    : posts.value.map((post) => ({
        kind: 'post',
        key: `post-${post.id}`,
        timestamp: post.created_at,
        post,
      }))
  const noteItems: BlogHomeStreamItem[] = typeFilter.value === 'post'
    ? []
    : shortNotes.value.map((note) => ({
        kind: 'note',
        key: `note-${note.id}`,
        timestamp: note.created_at,
        note,
      }))
  return [...postItems, ...noteItems].sort((left, right) => (
    new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime()
  ))
})


const isBookmarked = (item: BlogHomeListItem) => Boolean(feedStore.bookmarkedPostIds?.has(item.id))
const isStarred = (item: BlogHomeListItem) => Boolean(feedStore.starredItemIds?.has(item.id))
const isReadingList = (item: BlogHomeListItem) => Boolean(feedStore.readingListItemIds?.has(item.id))

const toggleBookmark = (item: BlogHomeListItem) => {
  if (item.source === 'feed') {
    void feedStore.toggleStar(item.id)
    return
  }
  void feedStore.togglePostBookmark(item.id)
}

const toggleStar = (item: BlogHomeListItem) => {
  void feedStore.toggleStar(item.id)
}

const toggleReadingList = (item: BlogHomeListItem) => {
  void feedStore.toggleReadingListItem(item.id)
}

const selectType = (value: string) => {
  typeFilter.value = value === 'note' || value === 'post' ? value : 'all'
  void Promise.all([fetchPosts(), fetchShortNotes()])
}

const selectSort = (value: string) => {
  sortBy.value = value
  void fetchPosts()
}

const selectRecommendationMode = (value: string) => {
  recommendationMode.value = value as 'hot' | 'featured' | 'discover'
  void fetchRecommendedPosts()
}

const openPost = (item: BlogHomeListItem) => {
  if (item.source === 'post') {
    blogSheets.openPost(item.id, item.title)
    return
  }
  void router.push(item.targetPath)
}

const openChannel = (channel: BlogChannel) => {
  blogSheets.openChannel(String(channel.id), channel.name)
}

const postIdFromTargetPath = (targetPath: string) => {
  const match = targetPath.match(/^\/posts\/post\/([^/?#]+)/)
  return match?.[1]
}

const openRecommendedPost = (item: { id: string; title: string; targetPath: string }) => {
  const postId = postIdFromTargetPath(item.targetPath)
  if (postId) {
    blogSheets.openPost(postId, item.title)
    return
  }
  void router.push(item.targetPath)
}

const fetchChannels = async () => {
  try {
    const res = await apiRequestResult(api.blog.channels)
    if (!res.ok) return
    const d = await Promise.resolve(res.data) as { data?: BlogChannel[] }
    channels.value = Array.isArray(d.data) ? d.data : []
  } catch (error) {
    reportError(error)
  }
}

const fetchRecommendedPosts = async () => {
  recommendationLoading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const res = await apiRequestResult(`${api.url}/blog/recommend/posts?mode=${recommendationMode.value}&page=1&page_size=20`, { headers })
    if (!res.ok) return
    const data = await Promise.resolve(res.data) as { data?: RecommendationPayload[] }
    recommendedPosts.value = Array.isArray(data.data)
      ? data.data.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary ?? '',
          image_url: item.image_url ?? '',
          targetPath: item.target_path || `/posts/post/${item.id}`,
          score_label: item.score_label ?? '',
        }))
      : []
  } catch (error) {
    reportError(error)
    recommendedPosts.value = []
  } finally {
    recommendationLoading.value = false
  }
}

const fetchShortNotes = async () => {
  if (typeFilter.value === 'post') {
    shortNotes.value = []
    notesLoading.value = false
    return true
  }
  notesLoading.value = true
  try {
    const query = new URLSearchParams({ page: '1', page_size: String(PAGE_SIZE) })
    const response = await apiRequestEnvelope<ShortNote[], { has_more?: boolean }>(`${api.blog.shortNotes}?${query}`)
    shortNotes.value = response.data
    return true
  } catch (error) {
    reportError(error)
    shortNotes.value = []
    return false
  } finally {
    notesLoading.value = false
  }
}

const deletePendingNote = async () => {
  const note = pendingDeleteNote.value
  if (!note || deletingNote.value || !authStore.token) return
  deletingNote.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(note.id), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    shortNotes.value = shortNotes.value.filter((item) => item.id !== note.id)
    pendingDeleteNote.value = null
  } catch (error) {
    reportError(error)
  } finally {
    deletingNote.value = false
  }
}

const fetchPosts = async (append = false) => {
  if (typeFilter.value === 'note') {
    posts.value = []
    hasMore.value = false
    loading.value = false
    return true
  }
  const requestSequence = ++postsRequestSequence
  const targetPage = append ? page.value + 1 : 1
  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const isPopular = sortBy.value === 'popular'
    const query = new URLSearchParams()
    query.set('page', String(targetPage))
    query.set('page_size', String(PAGE_SIZE))
    if (activeQuery.value) query.set('q', activeQuery.value)
    const endpoint = isPopular
      ? `${api.url}/feed/recommend/articles?${new URLSearchParams({ mode: 'hot', page: String(targetPage), page_size: String(PAGE_SIZE), ...(activeQuery.value ? { q: activeQuery.value } : {}) }).toString()}`
      : `${api.blog.posts}?${query.toString()}`

    const res = await apiRequestResult(endpoint, { headers })
    if (requestSequence !== postsRequestSequence) return false
    if (res.ok) {
      const d = await Promise.resolve(res.data) as { data?: RecommendationPayload[]; meta?: { has_more?: boolean } }
      if (requestSequence !== postsRequestSequence) return false
      const rawData = d.data || []
      const extractedPosts = rawData.map((item): BlogHomeListItem | null => {
        if (isPopular) {
          const targetPath = item.target_path || `/feed/item/${item.id}`
          const targetPostId = postIdFromTargetPath(targetPath)
          const source = targetPostId ? 'post' : 'feed'
          return {
            id: targetPostId || item.id,
            title: item.title,
            summary: item.summary,
            cover_url: item.image_url,
            view_count: item.view_count ?? item.read_count ?? 0,
            rating_score: item.rating_score ?? 0,
            rating_count: item.rating_count ?? 0,
            bookmarks_count: item.bookmark_count ?? 0,
            likes_count: 0,
            source,
            targetPath,
          }
        }
        const post = item.post || item
        if (post?.id) {
          return {
            ...post,
            source: 'post',
            targetPath: `/posts/post/${post.id}`,
          }
        }
        return null
      }).filter((item): item is BlogHomeListItem => item !== null)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      hasMore.value = isPopular
        ? Boolean(d.meta?.has_more)
        : typeof d.meta?.has_more === 'boolean' ? d.meta.has_more : rawData.length === PAGE_SIZE
      page.value = targetPage
      return true
    }
  } catch (e) {
    reportError(e)
  } finally {
    if (requestSequence === postsRequestSequence) loading.value = false
  }
  return false
}

const loadMore = () => {
  if (!loading.value && hasMore.value) void fetchPosts(true)
}

onMounted(() => {
  void Promise.all([fetchPosts(), fetchShortNotes(), fetchRecommendedPosts(), fetchChannels()])
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
  }
})

onUnmounted(() => {
  postsRequestSequence += 1
})

watch(activeQuery, () => {
  if (sortBy.value !== 'popular') {
    void fetchPosts()
  }
})
</script>

<style scoped>
.blog-home {
  max-width: 72rem;
  margin: 0 auto;
}

.blog-home__filters {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.blog-home__filter-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blog-home__filter-group--end {
  margin-left: auto;
}

/* 生产 Stream + Rail 布局 */
.blog-home__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 2rem;
  align-items: start;
}

.blog-home__stream {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.blog-home__recommendations {
  margin-bottom: 1.5rem;
}

.blog-home__recommendation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.blog-home__recommendation-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.blog-home__recommendation-note {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--a-color-muted);
}

.blog-home__recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.blog-home__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.blog-home__feed {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.blog-home__entry-card {
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.blog-home__entry-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.blog-home__author {
  font-weight: 500;
  color: var(--a-color-text);
}

.blog-home__channel {
  color: var(--a-color-primary);
  font-weight: 500;
  text-decoration: none;
}

.blog-home__channel:hover {
  text-decoration: underline;
}

.blog-home__dot {
  color: var(--a-color-muted-soft);
}

.blog-home__time {
  color: var(--a-color-muted);
}

.blog-home__post-visual {
  width: 6.5rem;
  height: 6.5rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.blog-home__post-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 侧轨 */
.blog-home__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.blog-home__rail-section {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.blog-home__rail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.blog-home__rail-header h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.blog-home__rail-icon.is-hot {
  color: var(--a-color-warning);
}

.blog-home__rail-icon.is-sparkles {
  color: var(--a-color-primary);
}

.blog-home__rail-list {
  display: flex;
  flex-direction: column;
}

.blog-home__channel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  text-decoration: none;
  transition: background 0.15s ease;
}

.blog-home__channel-item:last-child {
  border-bottom: 0;
}

.blog-home__channel-item:hover {
  background: var(--a-color-surface-muted);
}

.blog-home__channel-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.blog-home__channel-name {
  font-size: 0.85rem;
  color: var(--a-color-fg);
  font-weight: 600;
}

.blog-home__channel-desc {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-home__rail-note {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  cursor: pointer;
  transition: background 0.15s ease;
}

.blog-home__rail-note:last-child {
  border-bottom: 0;
}

.blog-home__rail-note:hover {
  background: var(--a-color-surface-muted);
}

.blog-home__rail-title {
  font-size: 0.85rem;
  line-height: 1.4;
  font-weight: 550;
  color: var(--a-color-fg);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.blog-home__rail-sub {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

@media (max-width: 1024px) {
  .blog-home__layout {
    grid-template-columns: 1fr;
  }
  .blog-home__rail {
    display: none;
  }
}
@media (max-width: 720px) {
  .blog-home__filters {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-right: -1rem;
    padding-right: 1rem;
    scrollbar-width: none;
  }

  .blog-home__filters::-webkit-scrollbar {
    display: none;
  }

  .blog-home__filter-group {
    flex: 0 0 auto;
  }

  .blog-home__filter-group--end {
    margin-left: 0;
  }

  .blog-home__layout {
    gap: 1rem;
  }

  .blog-home__stream {
    gap: 1rem;
  }
}
</style>
