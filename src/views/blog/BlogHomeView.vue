<template>
  <div class="a-page blog-home">
    <PPageHeader title="文章" accent>
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
        <!-- 推荐区 section -->
        <section class="blog-home__recommendations" aria-label="文章推荐">
          <div class="blog-home__recommendation-header">
            <div>
              <h2 class="blog-home__recommendation-title">推荐文章</h2>
              <p class="blog-home__recommendation-note">按热度、精选、探索切换当前文章推荐。</p>
            </div>
            <PSegmentedControl
              v-model="recommendationMode"
              :options="recommendationOptions"
              @change="selectRecommendationMode"
            />
          </div>

          <div v-if="recommendationLoading" class="blog-home__skeleton-list">
            <div v-for="i in 2" :key="i" class="a-skeleton" style="height: 6rem; border-radius: var(--a-radius-card);" />
          </div>
          <PEmpty v-else-if="!recommendedPosts.length" title="暂无推荐" description="稍后再来看新的文章推荐。" />
          <div v-else class="blog-home__recommendation-list">
            <PEntry
              v-for="item in recommendedPosts.slice(0, 3)"
              :key="item.id"
              :title="item.title"
              :summary="item.summary"
              class="blog-home__hero-entry"
              @click="openRecommendedPost(item)"
            >
              <template #visual>
                <div v-if="item.image_url" class="blog-home__post-visual">
                  <img :src="item.image_url" :alt="item.title" class="blog-home__post-cover" />
                </div>
                <PAvatar v-else size="sm" :name="item.title" />
              </template>
              <template #meta>
                <span v-if="item.score_label">{{ item.score_label }}</span>
              </template>
            </PEntry>
          </div>
        </section>

        <!-- 主文章列表流 -->
        <div v-if="loading && !posts.length" class="blog-home__skeleton-list">
          <div v-for="i in 5" :key="i" class="a-skeleton" style="height: 8rem; border-radius: var(--a-radius-card);" />
        </div>

        <PEmpty v-else-if="!posts.length" title="暂无内容" description="还没有发布任何内容" />

        <div v-else class="blog-home__feed">
          <PEntry
            v-for="post in posts"
            :key="post.id"
            :title="post.title"
            :summary="post.summary"
            class="blog-home__entry-card"
            @click="openPost(post)"
          >
            <template #visual>
              <div v-if="post.cover_url" class="blog-home__post-visual">
                <img :src="post.cover_url" :alt="post.title" class="blog-home__post-cover" loading="lazy" />
              </div>
              <PAvatar
                v-else
                :src="post.user?.avatar_url"
                :name="post.user?.display_name || post.user?.username || '匿名'"
                size="sm"
              />
            </template>

            <template #meta>
              <span class="blog-home__author">{{ post.user?.display_name || post.user?.username || '匿名' }}</span>
              <template v-if="post.channel">
                <span class="blog-home__dot">·</span>
                <a
                  :href="channelUrl(String(post.channel.slug || post.channel.id))"
                  class="blog-home__channel"
                  @click.stop
                >
                  《{{ post.channel.name }}》
                </a>
              </template>
              <span class="blog-home__dot">·</span>
              <time class="blog-home__time">{{ formatDate(post.created_at) }}</time>
            </template>

            <template #actions>
              <button
                type="button"
                class="p-clip"
                :class="{ active: isBookmarked(post) }"
                title="收藏"
                @click.stop="toggleBookmark(post)"
              >
                <Bookmark :size="14" />
              </button>
              <button
                type="button"
                class="p-clip"
                :class="{ active: isReadingList(post) }"
                title="稍后阅读"
                @click.stop="toggleReadingList(post)"
              >
                <Clock :size="14" />
              </button>
              <button
                type="button"
                class="p-clip"
                :class="{ active: isStarred(post) }"
                title="星标"
                @click.stop="toggleStar(post)"
              >
                <Star :size="14" />
              </button>
            </template>
          </PEntry>
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
            <a
              v-for="ch in channels.slice(0, 5)"
              :key="ch.id"
              :href="channelUrl(String(ch.slug || ch.id))"
              class="blog-home__channel-item"
            >
              <div class="blog-home__channel-info">
                <strong class="blog-home__channel-name">《{{ ch.name }}》</strong>
                <span v-if="ch.description" class="blog-home__channel-desc">{{ ch.description }}</span>
              </div>
            </a>
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
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, Clock, Flame, Sparkles, Star } from 'lucide-vue-next'

import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

import { apiRequest } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { channelUrl } from '@/router/siteUrls'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { reportError } from '@/utils/logger'

defineOptions({ name: 'BlogHomeView' })

interface BlogChannel {
  id: string | number
  name: string
  slug?: string
  description?: string
}

interface BlogHomeListItem {
  id: string
  title: string
  summary?: string
  cover_url?: string
  created_at?: string
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
  post?: BlogHomeListItem
}

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const blogSheets = useBlogSheets()
const api = useApi()

const posts = ref<BlogHomeListItem[]>([])
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
const typeFilter = ref('all')
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
  { label: '全部文章', value: 'all' },
  { label: '文章', value: 'post' },
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
  typeFilter.value = value
  void fetchPosts()
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
    const res = await apiRequest(api.blog.channels)
    if (!res.ok) return
    const d = await res.json() as { data?: BlogChannel[] }
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

    const res = await apiRequest(`${api.url}/blog/recommend/posts?mode=${recommendationMode.value}&page=1&page_size=20`, { headers })
    if (!res.ok) return
    const data = await res.json() as { data?: RecommendationPayload[] }
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

const fetchPosts = async (append = false) => {
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
      ? `${api.url}/feed/recommend/articles?mode=hot&page=${targetPage}&page_size=${PAGE_SIZE}`
      : `${api.blog.posts}?${query.toString()}`

    const res = await apiRequest(endpoint, { headers })
    if (requestSequence !== postsRequestSequence) return false
    if (res.ok) {
      const d = await res.json() as { data?: RecommendationPayload[]; meta?: { has_more?: boolean } }
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
            likes_count: 0,
            comments_count: 0,
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
  void fetchPosts()
  void fetchRecommendedPosts()
  void fetchChannels()
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
</style>
