<template>
  <div class="blog-home">
    <PPageHeader title="发现" accent>
      <template #action>
        <PButton v-if="!authStore.isAuthenticated" to="/login" variant="secondary">登录</PButton>
        <div v-else class="blog-home__preference-actions">
          <PButton size="sm" variant="ghost" :loading="recommendationPreferenceLoading" @click="toggleRecommendationPreference">
            {{ personalizedRecommendations ? '个性化推荐：开' : '个性化推荐：关' }}
          </PButton>
          <PButton size="sm" variant="ghost" :loading="recommendationPreferenceLoading" @click="clearRecommendationData">清除推荐数据</PButton>
        </div>
      </template>
    </PPageHeader>

    <ContentContinueSection module="blog" />

    <BlogHomeDigestSection
      :digest="digest"
      :loading="digestLoading"
      :error="digestError"
      @open-item="openDigestItem"
      @retry="fetchDigest"
    />

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
        <PUnifiedSearchBar
          v-model="blogSearchQuery"
          module="blog"
          :types="[...blogSearchTypes]"
          size="sm"
          placeholder="搜索公开文章、短笺或频道"
          action-button-text="搜索"
          input-test-id="blog-module-search-input"
          dropdown-test-id="blog-module-search-dropdown"
          :auto-navigate-on-select="false"
          @search="submitBlogSearch"
          @select="(hit) => openBlogSearchTarget({ path: hit.href || '', type: hit.type as any, id: hit.id, label: hit.title, module: hit.module, available: true })"
        />
      </div>
      <template v-if="isSearchMode">
        <div class="blog-home__filter-group blog-home__structured-filters" aria-label="结构化筛选">
          <PSelect
            v-if="activeQuery"
            v-model="searchAuthorID"
            label="作者"
            placeholder="全部作者"
            :options="authorOptions"
            @update:model-value="updateSearchAuthor"
          />
          <PSelect
            v-if="activeQuery"
            v-model="searchChannelID"
            label="频道"
            placeholder="全部频道"
            :options="channelOptions"
            @update:model-value="updateSearchChannel"
          />
          <PSelect
            v-if="activeQuery && searchChannelID"
            v-model="searchCollectionID"
            label="合集"
            placeholder="全部合集"
            :options="collectionOptions"
            :disabled="collectionsLoading"
            @update:model-value="updateSearchCollection"
          />
        </div>
      </template>
      <template v-if="!isSearchMode">
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
            size="sm"
            label="换一批"
            :loading="loading"
            @click="refreshStreamBatch"
          />
        </div>
      </template>
      <div v-else class="blog-home__filter-group blog-home__filter-group--end">
        <span v-if="activeTag" class="blog-home__active-tag">标签：{{ activeTag }}</span>
        <PButton size="sm" variant="ghost" :label="activeTag ? '清除标签' : '清除搜索'" @click="clearBlogSearch" />
      </div>
    </div>

    <!-- 生产环境 Stream + Sticky Rail 主布局 -->
    <div class="blog-home__layout">
      <!-- 左侧内容流 Stream -->
      <main class="blog-home__stream">

        <!-- 主文章列表流 -->
        <div v-if="isStreamLoading && !initialStreamReady" class="blog-home__skeleton-list">
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
                <PBadge
                  v-if="streamItem.post.publicTagCount"
                  type="info"
                  no-dot
                  :label="`公共标签 ${streamItem.post.publicTagCount}`"
                />
              </template>
              <template #source-action>
                <PButton
                  v-if="authStore.isAuthenticated && !isSearchMode"
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
          v-if="hasMore || notesHasMore"
          block
          variant="secondary"
          :loading="loading"
          style="margin-top: 1rem"
          @click="loadMore"
        >
          加载更多
        </PButton>
      </main>

      <!-- 右侧发现辅助栏 -->
      <BlogHomeRail
        :channels="channels"
        @open-channel="openChannel"
      />
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
import { EyeOff, Undo2 } from 'lucide-vue-next'

import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import BlogHomeRail from './BlogHomeRail.vue'
import BlogHomeDigestSection from './BlogHomeDigestSection.vue'
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
import { useBlogHomeDigest } from '@/composables/blog/useBlogHomeDigest'
import { useBlogHomePreferences } from '@/composables/blog/useBlogHomePreferences'
import type {
  BlogChannel,
  BlogCollection,
  BlogHomeListItem,
  BlogHomeStreamItem,
  RecommendationPayload,
} from './blogHomeTypes'

defineOptions({ name: 'BlogHomePage' })

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
let searchCollectionsRequestSequence = 0

const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)
const notesPage = ref(1)
const notesHasMore = ref(false)
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
const activeTag = computed(() => {
  const value = queryValue(route.query.tag)
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
})
const isSearchMode = computed(() => Boolean(activeQuery.value || activeTag.value))
const blogSearchQuery = ref(activeQuery.value)
const searchAuthorID = ref(typeof queryValue(route.query.author_id) === 'string' ? queryValue(route.query.author_id) as string : '')
const searchChannelID = ref(typeof queryValue(route.query.channel_id) === 'string' ? queryValue(route.query.channel_id) as string : '')
const searchCollectionID = ref(typeof queryValue(route.query.collection_id) === 'string' ? queryValue(route.query.collection_id) as string : '')
let postsRequestSequence = 0
const recordedImpressions = new Set<string>()

const {
  digest,
  digestLoading,
  digestError,
  fetchDigest,
  openDigestItem,
} = useBlogHomeDigest()

const {
  personalizedRecommendations,
  recommendationPreferenceLoading,
  hiddenRecommendation,
  hidingPostId,
  feedbackError,
  loadRecommendationPreference,
  toggleRecommendationPreference,
  clearRecommendationData,
  hideRecommendation,
  restoreRecommendation,
} = useBlogHomePreferences({
  isSearchMode,
  posts,
  fetchPosts: () => fetchPosts(),
})

const recordPostImpressions = (items: BlogHomeListItem[]) => {
  const source = isSearchMode.value
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
    const name = channel.user?.display_name || channel.user?.username
    if (!name) continue
    authors.set(authorID, name)
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
const initialStreamReady = ref(false)
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
  const query: Record<string, string> = {}
  if (search) {
    query.q = search
  } else if (activeTag.value) {
    query.tag = activeTag.value
  } else {
    if (typeFilter.value !== 'all') query.type = typeFilter.value
    if (typeFilter.value !== 'note' && recommendationMode.value !== 'hot') query.mode = recommendationMode.value
    return query
  }

  if (searchAuthorID.value) query.author_id = searchAuthorID.value
  if (searchChannelID.value) query.channel_id = searchChannelID.value
  if (searchCollectionID.value) query.collection_id = searchCollectionID.value
  return query
}

const syncHomeQuery = () => router.replace({ path: route.path, query: homeQuery() })

const submitBlogSearch = (value: string) => {
  if (value.trim()) typeFilter.value = 'all'
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
    case 'tag': return '标签匹配'
    default: return '相关结果'
  }
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
  const requestSequence = ++searchCollectionsRequestSequence
  searchCollections.value = []
  if (!channelID) return
  collectionsLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.channelCollections(channelID))
    if (requestSequence !== searchCollectionsRequestSequence) return
    if (!res.ok) return
    const payload = await Promise.resolve(res.data) as { data?: BlogCollection[] } | BlogCollection[]
    const items = Array.isArray(payload) ? payload : payload.data
    searchCollections.value = Array.isArray(items) ? items : []
  } catch (error) {
    reportError(error)
  } finally {
    if (requestSequence === searchCollectionsRequestSequence) collectionsLoading.value = false
  }
}


const fetchShortNotes = async (append = false) => {
  if (typeFilter.value === 'post' || isSearchMode.value) {
    shortNotes.value = []
    notesPage.value = 1
    notesHasMore.value = false
    notesError.value = false
    notesLoading.value = false
    return true
  }
  notesLoading.value = true
  notesError.value = false
  try {
    const targetPage = append ? notesPage.value + 1 : 1
    const query = new URLSearchParams({ page: String(targetPage), page_size: String(PAGE_SIZE) })
    const response = await apiRequestEnvelope<ShortNote[], { has_more?: boolean }>(`${api.blog.shortNotes}?${query}`)
    shortNotes.value = append ? [...shortNotes.value, ...response.data] : response.data
    notesPage.value = targetPage
    notesHasMore.value = Boolean(response.meta?.has_more)
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
    feedbackError.value = '短笺删除失败，请稍后重试'
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
    if (isSearchMode.value) {
      query = new URLSearchParams()
      if (activeQuery.value) query.set('q', activeQuery.value)
      if (activeTag.value) query.set('tag', activeTag.value)
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
    const endpoint = isSearchMode.value
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
          recommendationReason: isSearchMode.value
            ? searchMatchLabel(item.match_field)
            : item.score_label,
          view_count: item.view_count ?? item.read_count ?? 0,
          read_count: item.read_count ?? 0,
          rating_score: item.rating_score ?? 0,
          rating_count: item.rating_count ?? 0,
          bookmarks_count: item.bookmarks_count ?? item.bookmark_count ?? 0,
          likes_count: item.likes_count ?? 0,
          comments_count: item.comments_count ?? 0,
          publicTagCount: item.public_tag_count ?? 0,
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
  if (loading.value || notesLoading.value) return
  if (hasMore.value) void fetchPosts(true)
  if (notesHasMore.value) void fetchShortNotes(true)
}

onMounted(() => {
  void Promise.all([fetchPosts(), fetchShortNotes()]).finally(() => { initialStreamReady.value = true })
  void Promise.all([fetchChannels(), fetchSearchCollections(searchChannelID.value), fetchDigest()])
  if (authStore.isAuthenticated) {
    void loadRecommendationPreference()
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
  }
})

onUnmounted(() => {
  postsRequestSequence += 1
})

watch(
  [activeQuery, activeTag, () => queryValue(route.query.author_id), () => queryValue(route.query.channel_id), () => queryValue(route.query.collection_id)],
  ([value, _tag, rawAuthorID, rawChannelID, rawCollectionID], oldValues) => {
    if (value && typeFilter.value !== 'all') typeFilter.value = 'all'
    if (value !== blogSearchQuery.value) blogSearchQuery.value = value
    const nextAuthorID = typeof rawAuthorID === 'string' ? rawAuthorID : ''
    const nextChannelID = typeof rawChannelID === 'string' ? rawChannelID : ''
    const nextCollectionID = typeof rawCollectionID === 'string' ? rawCollectionID : ''
    searchAuthorID.value = nextAuthorID
    searchChannelID.value = nextChannelID
    searchCollectionID.value = nextCollectionID
    const previousChannelID = typeof oldValues?.[3] === 'string' ? oldValues[3] : ''
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
@import "./blogHomePage.css";
</style>
