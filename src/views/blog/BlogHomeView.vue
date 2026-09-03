<template>
  <div class="a-page blog-home">
    <PPageHeader title="发现" accent>
      <template #action>
        <PButton v-if="!authStore.isAuthenticated" to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <ContentContinueSection module="blog" />

    <section
      v-if="digestLoading || digest || digestError"
      class="blog-home__digest"
      :aria-labelledby="digest ? 'blog-digest-title' : undefined"
      :aria-label="digestError ? '订阅摘要' : undefined"
    >
      <div v-if="digestLoading" class="a-skeleton blog-home__digest-skeleton" aria-hidden="true" />
      <template v-else-if="digest">
        <div class="blog-home__digest-summary">
          <p class="blog-home__digest-eyebrow">订阅{{ digest.period === 'day' ? '日报' : '周报' }}</p>
          <h2 id="blog-digest-title">过去{{ digest.period === 'day' ? '24 小时' : '7 天' }}有 {{ digest.total }} 篇新文章</h2>
        </div>
        <div class="blog-home__digest-items">
          <button
            v-for="item in digest.items"
            :key="item.id"
            type="button"
            class="blog-home__digest-item"
            @click="openDigestItem(item)"
          >
            <span>{{ item.title }}</span>
            <small>{{ item.channel?.name || '订阅频道' }}</small>
          </button>
        </div>
      </template>
      <p v-else class="blog-home__digest-error" role="status">
        订阅摘要加载失败
        <PButton size="sm" variant="ghost" label="重试" @click="fetchDigest" />
      </p>
    </section>

    <p v-if="hiddenRecommendation" class="blog-home__feedback-status" role="status">
      已不再推荐《{{ hiddenRecommendation.title }}》
      <PButton size="sm" variant="ghost" @click="restoreRecommendation">
        <Undo2 :size="14" aria-hidden="true" />
        撤销
      </PButton>
    </p>
    <p v-if="feedbackError" class="a-error" role="alert">{{ feedbackError }}</p>

    <!-- 筛选控制栏 -->
    <div class="blog-home__filters" aria-label="文章筛选">
      <div class="blog-home__filter-group blog-home__filter-group--search">
        <ModuleSearch
          v-model="blogSearchQuery"
          :target-types="blogSearchTypes"
          placeholder="搜索公开文章、短笺或频道"
          input-test-id="blog-module-search-input"
          dropdown-test-id="blog-module-search-dropdown"
          @submit="submitBlogSearch"
          @select="openBlogSearchTarget"
        />
      </div>
      <template v-if="activeQuery">
        <div class="blog-home__filter-group blog-home__structured-filters" aria-label="结构化筛选">
          <PSelect
            v-model="searchAuthorID"
            label="作者"
            placeholder="全部作者"
            :options="authorOptions"
            @update:model-value="updateSearchAuthor"
          />
          <PSelect
            v-model="searchChannelID"
            label="频道"
            placeholder="全部频道"
            :options="channelOptions"
            @update:model-value="updateSearchChannel"
          />
          <PSelect
            v-if="searchChannelID"
            v-model="searchCollectionID"
            label="合集"
            placeholder="全部合集"
            :options="collectionOptions"
            :disabled="collectionsLoading"
            @update:model-value="updateSearchCollection"
          />
        </div>
      </template>
      <template v-if="!activeQuery">
        <div class="blog-home__filter-group">
          <PSegmentedControl
            v-model="typeFilter"
            :options="typeOptions"
            @change="selectType"
          />
        </div>
        <div v-if="typeFilter !== 'note'" class="blog-home__filter-group">
          <PSegmentedControl
            v-model="recommendationMode"
            :options="recommendationOptions"
            @change="selectRecommendationMode"
          />
        </div>
        <div class="blog-home__filter-group blog-home__filter-group--end">
          <PButton
            v-if="typeFilter !== 'note'"
            variant="primary"
            label="换一批"
            :loading="loading"
            @click="refreshStreamBatch"
          />
        </div>
      </template>
      <div v-else class="blog-home__filter-group blog-home__filter-group--end">
        <PButton size="sm" variant="ghost" label="清除搜索" @click="clearBlogSearch" />
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

        <PEmpty v-else-if="streamError && !streamItems.length" title="内容加载失败" :description="streamError" />

        <div v-else-if="streamItems.length" class="blog-home__feed feed-timeline-box">
          <template v-for="streamItem in streamItems" :key="streamItem.key">
            <BlogItemCard
              v-if="streamItem.kind === 'post'"
              :item="streamItem.post"
              :type="streamItem.post.source === 'feed' ? 'feed_item' : 'post'"
              :source-title="streamItem.post.sourceTitle"
              :bookmarked="isBookmarked(streamItem.post)"
              :in-reading-list="isReadingList(streamItem.post)"
              :starred="isStarred(streamItem.post)"
              @click="openPost(streamItem.post)"
              @toggle-bookmark="toggleBookmark(streamItem.post)"
              @toggle-reading-list="toggleReadingList(streamItem.post)"
              @toggle-star="toggleStar(streamItem.post)"
            >
              <template #meta-extra>
                <PBadge
                  v-if="streamItem.post.recommendationReason"
                  type="info"
                  no-dot
                  :label="streamItem.post.recommendationReason"
                />
              </template>
              <template #source-action>
                <PButton
                  v-if="authStore.isAuthenticated && !activeQuery"
                  size="sm"
                  variant="ghost"
                  :loading="hidingPostId === streamItem.post.id"
                  :aria-label="`不再推荐《${streamItem.post.title}》`"
                  :title="`不再推荐《${streamItem.post.title}》`"
                  data-test="blog-hide-recommendation"
                  @click.stop="hideRecommendation(streamItem.post)"
                >
                  <EyeOff :size="14" aria-hidden="true" />
                </PButton>
              </template>
            </BlogItemCard>
            <ShortNoteCard
              v-else
              :note="streamItem.note"
              @delete="pendingDeleteNote = streamItem.note"
            />
          </template>
        </div>

        <p v-if="streamError && streamItems.length" class="a-error" role="alert">{{ streamError }}</p>

        <PEmpty v-if="!isStreamLoading && !streamError && !streamItems.length" title="暂无内容" description="还没有发布任何内容" />

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

      <!-- 右侧发现辅助栏 -->
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
              :owner-name="ch.user?.display_name || ch.user?.username"
              :owner-avatar="ch.user?.avatar_url"
              :description="ch.description"
              :updated-at="ch.updated_at"
              :show-subscribe="false"
              @select="openChannel(ch)"
            />
          </div>
        </section>
      </aside>
    </div>
  </div>
  <PConfirm
    :show="pendingDeleteNote !== null"
    title="删除短笺"
    message="确定删除这条短笺吗？"
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
import { IconEyeOff as EyeOff, IconFlame as Flame, IconArrowBackUp as Undo2 } from '@tabler/icons-vue'

import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import BlogEntityCard from '@/components/blog/BlogEntityCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'

import { apiRequestEnvelope, apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useContentLifecycle } from '@/composables/useContentLifecycle'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { reportError } from '@/utils/logger'
import type { ReferenceTarget } from '@/api/references'
import { modulePathUrl } from '@/router/siteUrls'
import type { Post, ShortNote } from '@/types'

defineOptions({ name: 'BlogHomeView' })

interface BlogChannel {
  id: string | number
  name: string
  slug?: string
  description?: string
  cover_url?: string
  updated_at?: string
  user?: {
    uuid?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface BlogCollection {
  id: string | number
  name: string
}

interface BlogHomeListItem {
  id: string
  title: string
  summary?: string
  cover_url?: string
  created_at?: string
  view_count?: number
  read_count?: number
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
  sourceTitle?: string
  targetPath: string
  recommendationReason?: string
}

interface RecommendationPayload {
  id: string
  title: string
  summary?: string
  description?: string
  excerpt?: string
  image_url?: string
  cover_url?: string
  target_path?: string
  source_title?: string
  score_label?: string
  snippet?: string
  match_field?: string
  view_count?: number
  read_count?: number
  rating_score?: number
  rating_count?: number
  bookmark_count?: number
  bookmarks_count?: number
  likes_count?: number
  comments_count?: number
  created_at?: string
  published_at?: string
  user?: BlogHomeListItem['user']
  channel?: BlogChannel
  post?: BlogHomeListItem
}

interface BlogDigestPayload {
  period: 'day' | 'week'
  total: number
  items: Array<{
    id: string
    title: string
    target_path: string
    channel?: BlogChannel
  }>
}

const unwrapBlogDigest = (value: unknown): BlogDigestPayload | null => {
  const candidate = value && typeof value === 'object' && 'data' in value
    ? value.data
    : value
  if (!candidate || typeof candidate !== 'object') return null
  const digest = candidate as Partial<BlogDigestPayload>
  if ((digest.period !== 'day' && digest.period !== 'week') || typeof digest.total !== 'number' || !Array.isArray(digest.items)) {
    return null
  }
  return digest as BlogDigestPayload
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
const lifecycle = useContentLifecycle()
const api = useApi()

const posts = ref<BlogHomeListItem[]>([])
const shortNotes = ref<ShortNote[]>([])
const postsError = ref(false)
const notesError = ref(false)
const notesLoading = ref(false)
const pendingDeleteNote = ref<ShortNote | null>(null)
const deletingNote = ref(false)
const channels = ref<BlogChannel[]>([])
const searchCollections = ref<BlogCollection[]>([])
const collectionsLoading = ref(false)
const digest = ref<BlogDigestPayload | null>(null)
const digestLoading = ref(false)
const digestError = ref(false)
const hiddenRecommendation = ref<BlogHomeListItem | null>(null)
const hidingPostId = ref<string | null>(null)
const feedbackError = ref('')
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)
const queryValue = (value: unknown) => Array.isArray(value) ? value[0] : value
const normalizeTypeFilter = (value: unknown): 'all' | 'post' | 'note' => (
  queryValue(value) === 'post' || queryValue(value) === 'note' ? queryValue(value) as 'post' | 'note' : 'all'
)
const normalizeRecommendationMode = (value: unknown): 'hot' | 'featured' | 'discover' => (
  queryValue(value) === 'featured' || queryValue(value) === 'discover' ? queryValue(value) as 'featured' | 'discover' : 'hot'
)
const typeFilter = ref(normalizeTypeFilter(route.query.type))
const recommendationMode = ref(normalizeRecommendationMode(route.query.mode))
const blogSearchTypes = ['post', 'short_note', 'channel', 'collection'] as const
const activeQuery = computed(() => {
  const value = queryValue(route.query.q)
  return typeof value === 'string' ? value.trim() : ''
})
const blogSearchQuery = ref(activeQuery.value)
const searchAuthorID = ref(typeof queryValue(route.query.author_id) === 'string' ? queryValue(route.query.author_id) as string : '')
const searchChannelID = ref(typeof queryValue(route.query.channel_id) === 'string' ? queryValue(route.query.channel_id) as string : '')
const searchCollectionID = ref(typeof queryValue(route.query.collection_id) === 'string' ? queryValue(route.query.collection_id) as string : '')
let postsRequestSequence = 0
const recordedImpressions = new Set<string>()

const recordPostImpressions = (items: BlogHomeListItem[]) => {
  const source = activeQuery.value
    ? 'blog_search'
    : `blog_home:${recommendationMode.value}`
  for (const item of items) {
    if (item.source !== 'post') continue
    const key = `${source}:${item.id}`
    if (recordedImpressions.has(key)) continue
    recordedImpressions.add(key)
    void lifecycle.recordEvent({
      module: 'blog',
      content_id: item.id,
      event: 'impression',
      source,
    }).catch(() => undefined)
  }
}

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '文章', value: 'post' },
  { label: '短笺', value: 'note' },
]

const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const channelOptions = computed(() => [
  { label: '全部频道', value: '' },
  ...channels.value.map((channel) => ({ label: channel.name, value: String(channel.id) })),
])

const authorOptions = computed(() => {
  const authors = new Map<string, string>()
  for (const channel of channels.value) {
    const authorID = channel.user?.uuid
    if (!authorID || authors.has(authorID)) continue
    authors.set(authorID, channel.user?.display_name || channel.user?.username || authorID)
  }
  return [
    { label: '全部作者', value: '' },
    ...Array.from(authors, ([value, label]) => ({ value, label })),
  ]
})

const collectionOptions = computed(() => [
  { label: '全部合集', value: '' },
  ...searchCollections.value.map((collection) => ({ label: collection.name, value: String(collection.id) })),
])

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
const streamError = computed(() => {
  const errors: string[] = []
  if (typeFilter.value !== 'note' && postsError.value) errors.push('文章加载失败')
  if (typeFilter.value !== 'post' && notesError.value) errors.push('短笺加载失败')
  return errors.join('，')
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
  void syncHomeQuery()
  void Promise.all([fetchPosts(), fetchShortNotes()])
}

const selectRecommendationMode = (value: string) => {
  recommendationMode.value = value === 'featured' || value === 'discover' ? value : 'hot'
  void syncHomeQuery()
  void fetchPosts()
}

const homeQuery = (search = activeQuery.value) => {
  if (search) {
    const query: Record<string, string> = { q: search }
    if (searchAuthorID.value) query.author_id = searchAuthorID.value
    if (searchChannelID.value) query.channel_id = searchChannelID.value
    if (searchCollectionID.value) query.collection_id = searchCollectionID.value
    return query
  }
  const query: Record<string, string> = {}
  if (typeFilter.value !== 'all') query.type = typeFilter.value
  if (typeFilter.value !== 'note' && recommendationMode.value !== 'hot') query.mode = recommendationMode.value
  return query
}

const syncHomeQuery = () => router.replace({ path: route.path, query: homeQuery() })

const submitBlogSearch = (value: string) => {
  void router.replace({ path: route.path, query: homeQuery(value.trim()) })
}

const updateSearchAuthor = (value: string | number) => {
  searchAuthorID.value = String(value || '')
  void syncHomeQuery()
}

const updateSearchChannel = (value: string | number) => {
  searchChannelID.value = String(value || '')
  searchCollectionID.value = ''
  void syncHomeQuery()
}

const updateSearchCollection = (value: string | number) => {
  searchCollectionID.value = String(value || '')
  void syncHomeQuery()
}

const clearBlogSearch = () => {
  blogSearchQuery.value = ''
  void router.replace({ path: route.path })
}

const searchMatchLabel = (field?: string) => {
  switch (field) {
    case 'title': return '标题匹配'
    case 'summary': return '摘要匹配'
    case 'content': return '正文匹配'
    default: return '相关结果'
  }
}

const openDigestItem = (item: BlogDigestPayload['items'][number]) => {
  blogSheets.openPost(item.id, item.title)
}

const openBlogSearchTarget = (target: ReferenceTarget) => {
  void router.push(modulePathUrl('blog', target.path))
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

const fetchSearchCollections = async (channelID: string) => {
  searchCollections.value = []
  if (!channelID) return
  collectionsLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.channelCollections(channelID))
    if (!res.ok) return
    const payload = await Promise.resolve(res.data) as { data?: BlogCollection[] } | BlogCollection[]
    const items = Array.isArray(payload) ? payload : payload.data
    searchCollections.value = Array.isArray(items) ? items : []
  } catch (error) {
    reportError(error)
  } finally {
    collectionsLoading.value = false
  }
}

const fetchDigest = async () => {
  if (!authStore.token) {
    digest.value = null
    digestError.value = false
    return
  }
  digestLoading.value = true
  digestError.value = false
  try {
    const response = await apiRequestResult(api.blog.digest, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) throw new Error('digest request failed')
    const nextDigest = unwrapBlogDigest(response.data)
    if (!nextDigest) throw new Error('invalid digest response')
    digest.value = nextDigest.total > 0 ? nextDigest : null
  } catch (error) {
    reportError(error)
    digest.value = null
    digestError.value = true
  } finally {
    digestLoading.value = false
  }
}

const hideRecommendation = async (item: BlogHomeListItem) => {
  if (!authStore.token || hidingPostId.value) return
  hidingPostId.value = item.id
  feedbackError.value = ''
  try {
    const response = await apiRequestResult(api.blog.recommendationFeedback, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ content_id: item.id, action: 'hide' }),
    })
    if (!response.ok) throw new Error('recommendation feedback failed')
    posts.value = posts.value.filter((post) => post.id !== item.id)
    hiddenRecommendation.value = item
  } catch (error) {
    reportError(error)
    feedbackError.value = '暂时无法更新推荐，请稍后重试'
  } finally {
    hidingPostId.value = null
  }
}

const restoreRecommendation = async () => {
  const item = hiddenRecommendation.value
  if (!item || !authStore.token) return
  feedbackError.value = ''
  try {
    const response = await apiRequestResult(api.blog.recommendationFeedbackItem(item.id), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) throw new Error('recommendation restore failed')
    hiddenRecommendation.value = null
    await fetchPosts()
  } catch (error) {
    reportError(error)
    feedbackError.value = '暂时无法恢复推荐，请稍后重试'
  }
}

const fetchShortNotes = async () => {
  if (typeFilter.value === 'post' || activeQuery.value) {
    shortNotes.value = []
    notesError.value = false
    notesLoading.value = false
    return true
  }
  notesLoading.value = true
  notesError.value = false
  try {
    const query = new URLSearchParams({ page: '1', page_size: String(PAGE_SIZE) })
    const response = await apiRequestEnvelope<ShortNote[], { has_more?: boolean }>(`${api.blog.shortNotes}?${query}`)
    shortNotes.value = response.data
    return true
  } catch (error) {
    reportError(error)
    shortNotes.value = []
    notesError.value = true
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

const fetchPosts = async (append = false, requestedPage?: number) => {
  if (typeFilter.value === 'note') {
    posts.value = []
    postsError.value = false
    hasMore.value = false
    loading.value = false
    return true
  }
  const requestSequence = ++postsRequestSequence
  const targetPage = requestedPage ?? (append ? page.value + 1 : 1)
  loading.value = true
  postsError.value = false
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    let query: URLSearchParams
    if (activeQuery.value) {
      query = new URLSearchParams({ q: activeQuery.value })
      if (searchAuthorID.value) query.set('author_id', searchAuthorID.value)
      if (searchChannelID.value) query.set('channel_id', searchChannelID.value)
      if (searchCollectionID.value) query.set('collection_id', searchCollectionID.value)
      query.set('sort', 'relevance')
      query.set('page', String(targetPage))
      query.set('page_size', String(PAGE_SIZE))
    } else {
      query = new URLSearchParams({
          mode: recommendationMode.value,
          page: String(targetPage),
          page_size: String(PAGE_SIZE),
        })
    }
    const endpoint = activeQuery.value
      ? `${api.blog.search}?${query.toString()}`
      : `${api.blog.recommendPosts}?${query.toString()}`

    const res = await apiRequestResult(endpoint, { headers })
    if (requestSequence !== postsRequestSequence) return false
    if (res.ok) {
      const d = await Promise.resolve(res.data) as { data?: RecommendationPayload[]; meta?: { has_more?: boolean } }
      if (requestSequence !== postsRequestSequence) return false
      const rawData = d.data || []
      const extractedPosts = rawData.map((item): BlogHomeListItem | null => {
        if (!item?.id) return null
        const targetPath = item.target_path || `/posts/post/${item.id}`
        const source = targetPath.startsWith('/posts/post/') ? 'post' : 'feed'
        return {
          id: item.id,
          title: item.title,
          summary: item.snippet?.trim() || item.summary?.trim() || item.description?.trim() || item.excerpt?.trim() || undefined,
          cover_url: item.cover_url || item.image_url,
          created_at: item.published_at || item.created_at,
          recommendationReason: activeQuery.value
            ? searchMatchLabel(item.match_field)
            : item.score_label,
          view_count: item.view_count ?? item.read_count ?? 0,
          read_count: item.read_count ?? 0,
          rating_score: item.rating_score ?? 0,
          rating_count: item.rating_count ?? 0,
          bookmarks_count: item.bookmarks_count ?? item.bookmark_count ?? 0,
          likes_count: item.likes_count ?? 0,
          comments_count: item.comments_count ?? 0,
          user: item.user,
          channel: item.channel,
          source,
          targetPath,
        }
      }).filter((item): item is BlogHomeListItem => item !== null)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      recordPostImpressions(extractedPosts)
      hasMore.value = typeof d.meta?.has_more === 'boolean' ? d.meta.has_more : rawData.length === PAGE_SIZE
      page.value = targetPage
      postsError.value = false
      return true
    }
    postsError.value = true
  } catch (e) {
    reportError(e)
    postsError.value = true
  } finally {
    if (requestSequence === postsRequestSequence) loading.value = false
  }
  return false
}

const refreshStreamBatch = () => {
  void fetchPosts(false, hasMore.value ? page.value + 1 : 1)
}

const loadMore = () => {
  if (!loading.value && hasMore.value) void fetchPosts(true)
}

onMounted(() => {
  void Promise.all([fetchPosts(), fetchShortNotes(), fetchChannels(), fetchSearchCollections(searchChannelID.value), fetchDigest()])
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
  }
})

onUnmounted(() => {
  postsRequestSequence += 1
})

watch(
  [activeQuery, () => queryValue(route.query.author_id), () => queryValue(route.query.channel_id), () => queryValue(route.query.collection_id)],
  ([value, rawAuthorID, rawChannelID, rawCollectionID], oldValues) => {
    if (value !== blogSearchQuery.value) blogSearchQuery.value = value
    const nextAuthorID = typeof rawAuthorID === 'string' ? rawAuthorID : ''
    const nextChannelID = typeof rawChannelID === 'string' ? rawChannelID : ''
    const nextCollectionID = typeof rawCollectionID === 'string' ? rawCollectionID : ''
    searchAuthorID.value = nextAuthorID
    searchChannelID.value = nextChannelID
    searchCollectionID.value = nextCollectionID
    const previousChannelID = typeof oldValues?.[2] === 'string' ? oldValues[2] : ''
    if (nextChannelID !== previousChannelID) void fetchSearchCollections(nextChannelID)
    void Promise.all([fetchPosts(), fetchShortNotes()])
  },
)

watch([() => route.query.type, () => route.query.mode], ([rawType, rawMode]) => {
  const nextType = normalizeTypeFilter(rawType)
  const nextMode = normalizeRecommendationMode(rawMode)
  if (nextType === typeFilter.value && nextMode === recommendationMode.value) return
  typeFilter.value = nextType
  recommendationMode.value = nextMode
  void Promise.all([fetchPosts(), fetchShortNotes()])
})
</script>

<style scoped>
.blog-home {
  max-width: 72rem;
  margin: 0 auto;
}

.blog-home__digest {
  display: grid;
  grid-template-columns: minmax(12rem, 0.8fr) minmax(0, 1.2fr);
  gap: 1rem 1.5rem;
  align-items: start;
  margin: 1rem 0;
  padding: 0.9rem 0;
  border-block: 1px solid var(--a-color-border-soft);
}

.blog-home__digest-summary {
  min-width: 0;
}

.blog-home__digest-eyebrow {
  margin: 0 0 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.blog-home__digest h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 0.95rem;
  line-height: 1.45;
}

.blog-home__digest-items {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.blog-home__digest-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  width: 100%;
  padding: 0.35rem 0;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.blog-home__digest-item:last-child {
  border-bottom: 0;
}

.blog-home__digest-item > span,
.blog-home__digest-item > small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-home__digest-item > span {
  font-size: 0.82rem;
  font-weight: 550;
}

.blog-home__digest-item > small {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.blog-home__digest-item:hover,
.blog-home__digest-item:focus-visible {
  color: var(--a-color-primary);
  outline: none;
}

.blog-home__digest-item:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.blog-home__digest-skeleton {
  grid-column: 1 / -1;
  height: 4.5rem;
}

.blog-home__digest-error,
.blog-home__feedback-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.blog-home__feedback-status {
  margin: 0.5rem 0;
}

.blog-home__filters {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.blog-home__filter-group--search {
  flex: 1 1 20rem;
  min-width: min(100%, 18rem);
}


.blog-home__filter-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blog-home__filter-group--end {
  margin-left: auto;
}

.blog-home__filter-group--search :deep(.search-surface) {
  min-width: 100%;
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

.blog-home__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.blog-home__feed {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.blog-home__entry-card {
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.blog-home__entry-card:hover {
  border-color: var(--a-color-border);
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

.blog-home__feed.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.blog-home__feed :deep(.sticky-memo-card) {
  margin: 0;
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

@media (max-width: 1024px) {
  .blog-home__layout {
    grid-template-columns: 1fr;
  }
  .blog-home__rail {
    display: none;
  }
}
@media (max-width: 720px) {
  .blog-home__digest {
    grid-template-columns: 1fr;
  }

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
