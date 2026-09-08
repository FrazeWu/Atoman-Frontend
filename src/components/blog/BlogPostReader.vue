<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { IconBookmark as Bookmark, IconClock as Clock, IconPencil as Pencil } from '@tabler/icons-vue'

import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PToast from '@/components/ui/PToast.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import BlogRelatedPosts, { type BlogRelatedPost } from '@/components/blog/BlogRelatedPosts.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { applyResolvedReferences } from '@/composables/useReferenceRendering'
import { useBlogMediaEmbeds } from '@/composables/useBlogMediaEmbeds'
import { usePageMeta } from '@/composables/usePageMeta'
import { useInteractions } from '@/composables/useInteractions'
import { isAdminRole } from '@/utils/roles'
import { createContentConsumptionTracker, useContentLifecycle } from '@/composables/useContentLifecycle'
import type { Post } from '@/types'

type Presentation = 'page' | 'sheet'

type PostDetailResponse = Post & {
  liked?: boolean
  is_liked?: boolean
  like_count?: number
  comment_count?: number
}

const props = withDefaults(defineProps<{
  postId: string
  presentation?: Presentation
  layerKey?: string
  layerIndex?: number
  stackSize?: number
  collectionId?: string
}>(), {
  presentation: 'page',
  layerKey: '',
  layerIndex: 0,
  stackSize: 1,
  collectionId: undefined,
})

const isSheet = computed(() => props.presentation === 'sheet')
const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const sheets = useBlogSheets()
const { setPageMeta, restorePageMeta } = usePageMeta()
const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const { postEmbeds, musicEmbeds, videoEmbeds, load: loadMediaEmbeds } = useBlogMediaEmbeds()
const lifecycle = useContentLifecycle()
const postId = computed(() => props.postId)
const interactions = useInteractions('blog', 'post', postId)

const post = ref<Post | null>(null)
const loading = ref(true)
const errorStatus = ref<number | null>(null)
const errorMessage = ref('')
const readingMode = ref<'single' | 'double'>('single')
const bookmarked = ref(false)
const ratingLoading = ref(false)
const ratingError = ref('')
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const relatedPosts = ref<BlogRelatedPost[]>([])
const commentsOpen = ref(false)
const commentSheetMode = ref<'full' | 'partial'>('partial')
const commentCount = ref<number | undefined>(undefined)
const postContentAnchor = ref<HTMLElement | null>(null)
const shareToastVisible = ref(false)
const shareToastMessage = ref('')
const shareToastType = ref<'success' | 'warning'>('success')
const bookmarkFolders = ref<Array<{ id: string; name: string }>>([])
const bookmarkFoldersLoading = ref(false)
const newBookmarkFolderName = ref('')
const creatingBookmarkFolder = ref(false)

let loadSequence = 0
let ratingOperationSequence = 0
let bookmarkOperationSequence = 0
let relatedRequestSequence = 0
let consumptionTracker: ReturnType<typeof createContentConsumptionTracker> | null = null

const isAcademic = computed(() => readingMode.value === 'double')
const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)
const canDeleteAllComments = computed(() => Boolean(isOwner.value || isAdminRole(authStore.user?.role)))
const commentsBlockParent = computed(() => isSheet.value && commentsOpen.value && commentSheetMode.value === 'full')
const commentSheetTitle = computed(() => `博客文章评论-${post.value?.title || '未命名'}`)
const authorName = computed(() => post.value?.user?.display_name || post.value?.user?.username || '未知作者')
const authorHandle = computed(() => post.value?.user?.username ? `@${post.value.user.username}` : '')
const isInReadingList = computed(() => Boolean(post.value?.id && feedStore.readingListItemIds.has(post.value.id)))
const activeCommentCount = computed(() => commentCount.value ?? interactions.commentCount.value)
const readingModeOptions = computed(() => [
  { label: '单栏', value: 'single' as const, test: 'post-reading-single' },
  { label: isSheet.value ? '双栏' : '学术双栏', value: 'double' as const, test: 'post-reading-double' },
])

const isActiveSheet = computed(() => !isSheet.value || sheets.isActive(props.layerKey))

const normalizeTitleText = (text: string) => text.trim().replace(/\s+/g, ' ')

function stripLeadingDuplicateHeading(content: string, title: string) {
  const lines = content.split('\n')
  const firstLine = lines[0]?.trim() || ''
  const match = firstLine.match(/^#{1,6}\s+(.+)$/)
  if (!match || normalizeTitleText(match[1]) !== normalizeTitleText(title)) return content
  let startIndex = 1
  while (startIndex < lines.length && lines[startIndex].trim() === '') startIndex++
  return lines.slice(startIndex).join('\n')
}

const renderedContent = computed(() => {
  if (markdownRuntimeState) void markdownRuntimeState.value
  const content = post.value?.content ?? ''
  const title = post.value?.title ?? ''
  const referencedContent = applyResolvedReferences(content, post.value?.references)
  return renderMarkdown(stripLeadingDuplicateHeading(referencedContent, title), {
    postEmbeds: postEmbeds.value,
    musicEmbeds: musicEmbeds.value,
    videoEmbeds: videoEmbeds.value,
  })
})

const ACADEMIC_PAGE_LENGTH = 1_700

function paginateAcademicContent(content: string) {
  if (!content) return []
  const documentFragment = document.implementation.createHTMLDocument('academic-reader')
  documentFragment.body.innerHTML = content
  const blocks = Array.from(documentFragment.body.children)
  if (!blocks.length) return [content]

  const pages: string[] = []
  let page = ''
  let pageLength = 0
  for (const block of blocks) {
    const blockHtml = block.outerHTML
    const blockLength = block.textContent?.trim().length || 0
    if (page && pageLength + blockLength > ACADEMIC_PAGE_LENGTH) {
      pages.push(page)
      page = ''
      pageLength = 0
    }
    page += blockHtml
    pageLength += blockLength
  }
  if (page) pages.push(page)
  return pages
}

const academicPages = computed(() => paginateAcademicContent(renderedContent.value))

const readingTime = computed(() => {
  const plainText = (post.value?.content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~=-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `约 ${Math.max(1, Math.ceil(plainText.length / 400))} 分钟阅读`
})

function formatAcademicDate(value?: string) {
  if (!value) return '未记录'
  return new Date(value).toLocaleDateString('zh-CN')
}

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
  return headers
}
const currentLoad = (sequence: number, requestedId: string) => sequence === loadSequence && requestedId === postId.value
const readingSource = () => isSheet.value ? 'blog_sheet' : (typeof route.query.source === 'string' ? route.query.source : 'direct')

function trackReadingProgress() {
  if (isSheet.value || !post.value || !consumptionTracker) return
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? window.scrollY / scrollable : 1
  consumptionTracker.update(progress)
}

function startReadingTracking(contentId: string, source: string) {
  consumptionTracker = createContentConsumptionTracker({
    onEvent: event => void lifecycle.recordEvent({ module: 'blog', content_id: contentId, event, source }).catch(() => undefined),
    onProgress: progress => {
      if (!authStore.token) return
      void lifecycle.saveProgress({
        module: 'blog', content_id: contentId, position_sec: 0, duration_sec: 0,
        progress, completed: progress >= 0.95, source,
      }).catch(() => undefined)
    },
  })
  consumptionTracker.open()
  trackReadingProgress()
}

async function fetchPost() {
  const requestedId = postId.value
  const sequence = ++loadSequence
  ratingOperationSequence += 1
  bookmarkOperationSequence += 1
  loading.value = true
  errorStatus.value = null
  errorMessage.value = ''
  post.value = null
  relatedPosts.value = []
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
  commentCount.value = undefined
  readingMode.value = 'single'
  bookmarked.value = false
  channelSubscribed.value = false
  channelSubscriptionBusy.value = false
  ratingLoading.value = false
  ratingError.value = ''
  relatedRequestSequence += 1
  postEmbeds.value = {}
  musicEmbeds.value = {}
  videoEmbeds.value = {}
  interactions.liked.value = false
  interactions.likeCount.value = 0
  interactions.commentCount.value = 0
  consumptionTracker = null
  if (!isSheet.value) restorePageMeta()

  try {
    if (!requestedId) {
      errorStatus.value = 404
      errorMessage.value = '文章不存在'
      return
    }
    const response = await apiRequestResult(api.blog.post(requestedId), { headers: authHeaders() })
    if (!currentLoad(sequence, requestedId)) return
    if (!response.ok) {
      errorStatus.value = response.status
      errorMessage.value = response.status === 403 ? '该文章尚未发布，请登录后查看或编辑' : '文章暂时无法加载，请稍后重试。'
      if (!isSheet.value) restorePageMeta()
      return
    }

    const payload = await Promise.resolve(response.data)
    if (!currentLoad(sequence, requestedId)) return
    const detail = (payload.data || payload) as PostDetailResponse
    post.value = detail
    commentCount.value = detail.comments_count ?? detail.comment_count ?? 0
    interactions.liked.value = detail.liked ?? detail.is_liked ?? false
    interactions.likeCount.value = detail.likes_count ?? detail.like_count ?? 0
    interactions.commentCount.value = commentCount.value

    if (isSheet.value) {
      void lifecycle.recordEvent({ module: 'blog', content_id: detail.id, event: 'open', source: 'blog_sheet' }).catch(() => undefined)
    } else {
      startReadingTracking(detail.id, readingSource())
      const description = detail.summary?.trim() || detail.content.replace(/[#*`>~_\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
      setPageMeta({
        title: detail.title,
        description,
        canonical: `${window.location.origin}/posts/post/${encodeURIComponent(detail.id)}`,
        image: detail.cover_url || `${window.location.origin}/favicon.png`,
        author: detail.user?.display_name || detail.user?.username,
        publishedAt: detail.published_at || detail.created_at,
        updatedAt: detail.updated_at,
      })
      if (detail.channel_id) {
        void apiRequestResult(`${api.url}/feed/events/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ source_type: 'internal_channel', source_id: detail.channel_id, event_type: 'detail_open' }),
        }).catch(() => {})
      }
    }

    void fetchRelatedPosts(detail.id)
    await loadMediaEmbeds(detail.content, authStore.token ?? undefined)
    if (!currentLoad(sequence, requestedId)) return

    if (authStore.isAuthenticated && detail.channel_id) {
      void feedStore.isSubscribedToChannel(detail.channel_id).then((subscribed) => {
        if (currentLoad(sequence, requestedId)) channelSubscribed.value = subscribed
      })
    }

    if (authStore.isAuthenticated) {
      const bookmarkOperation = bookmarkOperationSequence
      void fetchBookmarkState(detail.id).then((state) => {
        if (currentLoad(sequence, requestedId) && bookmarkOperation === bookmarkOperationSequence && state !== null) bookmarked.value = state
      })
      void feedStore.fetchReadingListIds()
    }
  } catch (error) {
    if (!currentLoad(sequence, requestedId)) return
    reportError(error)
    errorStatus.value = 500
    errorMessage.value = '文章暂时无法加载，请稍后重试。'
    if (!isSheet.value) restorePageMeta()
  } finally {
    if (currentLoad(sequence, requestedId)) loading.value = false
  }
}

async function fetchRelatedPosts(contentId: string) {
  const sequence = ++relatedRequestSequence
  try {
    const response = await apiRequestResult(`${api.blog.relatedPosts(contentId)}?limit=6`, { headers: authHeaders() })
    if (sequence !== relatedRequestSequence || contentId !== postId.value || !response.ok) return
    const payload = await Promise.resolve(response.data) as unknown
    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : []
    relatedPosts.value = items.filter((item): item is BlogRelatedPost => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<BlogRelatedPost>
      return typeof candidate.id === 'string' && typeof candidate.title === 'string' && typeof candidate.target_path === 'string'
    })
  } catch (error) {
    if (sequence === relatedRequestSequence && contentId === postId.value) {
      reportError(error)
      relatedPosts.value = []
    }
  }
}

function openRelatedPost(item: BlogRelatedPost) {
  if (isSheet.value) {
    sheets.openPost(item.id, item.title, props.collectionId)
    return
  }
  void router.push({ path: item.target_path, query: { source: 'related' } })
}

async function fetchBookmarkState(contentId: string): Promise<boolean | null> {
  try {
    const response = await apiRequestResult(api.blog.bookmarks, { headers: authHeaders() })
    if (!response.ok) return null
    const payload = await Promise.resolve(response.data)
    const items = payload.data || []
    return items.some((item: { post_id: string }) => item.post_id === contentId)
  } catch (error) {
    reportError(error)
    return null
  }
}

async function toggleBookmark() {
  if (!post.value || !authStore.isAuthenticated) return
  const requestedId = post.value.id
  const sequence = loadSequence
  const operation = ++bookmarkOperationSequence
  const nextState = await feedStore.togglePostBookmark(requestedId)
  if (sequence === loadSequence && operation === bookmarkOperationSequence && postId.value === requestedId && nextState !== null) bookmarked.value = nextState
}

async function toggleReadingList() {
  if (!post.value || !authStore.isAuthenticated) return
  await feedStore.toggleReadingListItem(post.value.id)
}

function ratingFailureMessage(error?: { code?: string; message?: string }) {
  const message = error?.message?.trim()
  if (message && error?.code !== 'system.internal_error') return message
  return '评分未保存，请重试'
}

async function ratePost(score: number) {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  const requestedId = post.value.id
  const sequence = loadSequence
  const operation = ++ratingOperationSequence
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.blog.postRating(requestedId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ score }),
    })
    if (sequence !== loadSequence || operation !== ratingOperationSequence || postId.value !== requestedId) return
    if (!response.ok) {
      ratingError.value = ratingFailureMessage(response.error)
      return
    }
    const payload = await Promise.resolve(response.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? post.value.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? post.value.rating_count ?? 0)
    post.value.viewer_rating = Number(summary.viewer_rating ?? score)
  } catch (error) {
    if (sequence === loadSequence && operation === ratingOperationSequence) ratingError.value = ratingFailureMessage(error as { code?: string; message?: string })
  } finally {
    if (sequence === loadSequence && operation === ratingOperationSequence) ratingLoading.value = false
  }
}

async function clearPostRating() {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  const requestedId = post.value.id
  const sequence = loadSequence
  const operation = ++ratingOperationSequence
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.blog.postRating(requestedId), { method: 'DELETE', headers: authHeaders() })
    if (sequence !== loadSequence || operation !== ratingOperationSequence || postId.value !== requestedId) return
    if (!response.ok) {
      ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(response.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? 0)
    post.value.viewer_rating = undefined
  } catch {
    if (sequence === loadSequence && operation === ratingOperationSequence) ratingError.value = '评分未清除，请重试'
  } finally {
    if (sequence === loadSequence && operation === ratingOperationSequence) ratingLoading.value = false
  }
}

async function toggleChannelSubscription() {
  if (!post.value?.channel_id || !authStore.isAuthenticated || channelSubscriptionBusy.value) return
  channelSubscriptionBusy.value = true
  try {
    const success = channelSubscribed.value
      ? await feedStore.unsubscribeFromChannel(post.value.channel_id)
      : await feedStore.subscribeToChannel(post.value.channel_id)
    if (success) channelSubscribed.value = !channelSubscribed.value
  } finally {
    channelSubscriptionBusy.value = false
  }
}

function showShareFeedback(message: string, type: 'success' | 'warning' = 'success') {
  shareToastVisible.value = false
  shareToastMessage.value = message
  shareToastType.value = type
  window.setTimeout(() => { shareToastVisible.value = true }, 0)
}

async function sharePost() {
  if (!post.value) return
  const url = `${window.location.origin}/posts/post/${encodeURIComponent(post.value.id)}`
  const share = navigator.share?.bind(navigator)
  if (share) {
    try {
      await share({ title: post.value.title || document.title, text: post.value.summary || '', url })
      showShareFeedback('已分享')
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(url)
    showShareFeedback('链接已复制')
  } catch {
    showShareFeedback('分享失败，请手动复制链接', 'warning')
  }
}

async function loadBookmarkFolders() {
  if (!authStore.isAuthenticated || bookmarkFoldersLoading.value) return
  bookmarkFoldersLoading.value = true
  try {
    const response = await apiRequestResult(`${api.url}/blog/bookmark-folders`, { headers: authHeaders() })
    if (response.ok) {
      const payload = response.data as { data?: Array<{ id: string; name: string }> }
      bookmarkFolders.value = payload.data || []
    }
  } finally {
    bookmarkFoldersLoading.value = false
  }
}

async function addBookmark(folderId: string) {
  if (!post.value) return false
  const response = await apiRequestResult(`${api.url}/blog/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ content_id: post.value.id, bookmark_folder_id: folderId }),
  })
  if (!response.ok) return false
  feedStore.bookmarkedPostIds = new Set([...feedStore.bookmarkedPostIds, post.value.id])
  bookmarked.value = true
  return true
}

async function createBookmarkFolder(close: () => void) {
  const name = newBookmarkFolderName.value.trim()
  if (!name || creatingBookmarkFolder.value) return
  creatingBookmarkFolder.value = true
  try {
    const response = await apiRequestResult(`${api.url}/blog/bookmark-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    })
    const payload = response.data as { data?: { id: string; name: string } }
    if (response.ok && payload.data && await addBookmark(payload.data.id)) {
      bookmarkFolders.value = [...bookmarkFolders.value, payload.data]
      newBookmarkFolderName.value = ''
      close()
    }
  } finally {
    creatingBookmarkFolder.value = false
  }
}

function editPost() {
  if (!post.value) return
  const query = new URLSearchParams()
  if (post.value.channel_id) query.set('channel', post.value.channel_id)
  if (props.collectionId) query.set('collection', props.collectionId)
  const suffix = query.size ? `?${query.toString()}` : ''
  void router.push(`/studio/blog/${post.value.id}/edit${suffix}`)
}

function openTag(tag: string) {
  void router.push({ path: '/posts', query: { tag } })
}

function openComments() {
  commentSheetMode.value = 'partial'
  commentsOpen.value = true
}

function closeComments() {
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
}

function handleRenderedContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest<HTMLAnchorElement>('a[data-atoman-embed]')
  const href = link?.getAttribute('href')
  if (!link || !href || href.startsWith('#')) return
  event.preventDefault()
  void router.push(href)
}

watch(() => props.postId, () => { void fetchPost() }, { immediate: true })

onMounted(() => {
  if (!isSheet.value) window.addEventListener('scroll', trackReadingProgress, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', trackReadingProgress)
  if (!isSheet.value) restorePageMeta()
})

defineExpose({
  post,
  loading,
  errorStatus,
  isAcademic,
  readingMode,
  bookmarked,
  postEmbeds,
  musicEmbeds,
  videoEmbeds,
  commentsBlockParent,
  fetchPost,
})
</script>

<template>
  <div class="blog-post-reader" :class="`blog-post-reader--${presentation}`">
    <PToast v-model="shareToastVisible" :message="shareToastMessage" :type="shareToastType" />
    <div v-if="loading" class="post-reader-loading" aria-label="正在加载文章">
      <div class="a-skeleton post-reader-title-skeleton" />
      <div v-for="index in 6" :key="index" class="a-skeleton post-reader-line-skeleton" />
    </div>
    <PEmpty v-else-if="isSheet && errorMessage" kicker="" title="加载失败" :description="errorMessage">
      <template #action><PButton variant="secondary" size="sm" @click="fetchPost">重试</PButton></template>
    </PEmpty>
    <div v-else-if="!isSheet && errorStatus === 404" class="post-reader-error">
      <p class="post-reader-error__code">404</p><p class="a-muted">文章不存在</p><RouterLink to="/posts" class="a-link">返回文章</RouterLink>
    </div>
    <div v-else-if="!isSheet && errorStatus === 403" class="post-reader-error">
      <p class="post-reader-error__code">草稿</p><p class="a-muted">该文章尚未发布，请登录后查看或编辑</p><RouterLink :to="`/studio/blog/${postId}/edit`" class="a-link">去编辑 →</RouterLink>
    </div>
    <div v-else-if="!isSheet && errorStatus" class="post-reader-error">
      <p>文章暂时无法加载</p><p class="a-muted">请稍后重试，或返回文章列表。</p>
      <div class="post-reader-error__actions"><button type="button" class="a-btn a-btn--primary" @click="fetchPost">重试</button><RouterLink to="/posts" class="a-link">返回文章</RouterLink></div>
    </div>
    <article v-else-if="post" ref="postContentAnchor" class="post-reader-article" @click="handleRenderedContentClick">
      <div v-if="isOwner" class="post-sheet-actions">
        <RouterLink v-if="!isSheet" :to="`/studio/blog/${post.id}/edit`" class="a-btn a-btn--sm a-btn--primary">编辑</RouterLink>
        <PButton v-else variant="secondary" size="sm" @click="editPost"><Pencil :size="15" aria-hidden="true" />编辑</PButton>
      </div>
      <RouterLink v-if="!isSheet" to="/posts" class="a-link post-reader-breadcrumb">← 文章</RouterLink>
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.title" class="post-sheet-cover" />
      <div class="post-sheet-byline">
        <PAvatar class="post-sheet-author-avatar" :src="post.user?.avatar_url" :name="authorName" :alt="`${authorName} 的头像`" size="sm" />
        <div class="post-sheet-author-info">
          <div class="post-sheet-author-row"><span class="post-sheet-author">{{ authorName }}</span><span v-if="authorHandle" class="post-sheet-author-handle">{{ authorHandle }}</span></div>
          <div class="post-sheet-publishing-meta"><span>发布于 {{ new Date(post.created_at).toLocaleDateString('zh-CN') }}</span><span aria-hidden="true">·</span><span class="post-sheet-reading-time">{{ readingTime }}</span></div>
        </div>
        <button v-if="post.channel_id && authStore.isAuthenticated" type="button" class="post-sheet-subscribe" :class="{ 'is-subscribed': channelSubscribed }" :disabled="channelSubscriptionBusy" @click="toggleChannelSubscription">{{ channelSubscribed ? '已订阅频道' : '订阅频道' }}</button>
        <RouterLink v-else-if="post.channel_id" to="/login" class="post-sheet-subscribe">登录后订阅频道</RouterLink>
      </div>
      <h1>{{ post.title }}</h1>
      <p v-if="post.summary" class="post-sheet-summary">{{ post.summary }}</p>
      <div class="post-sheet-detail-toolbar">
        <div v-if="post.tags?.length" class="post-sheet-tags" aria-label="文章标签"><button v-for="tag in post.tags" :key="tag" type="button" @click="openTag(tag)">{{ tag }}</button></div>
        <PSegmentedControl v-model="readingMode" :options="readingModeOptions" />
      </div>
      <BlogPostUpdateNotice :variant="isSheet ? 'compact' : 'default'" :updated-at="post.updated_at" />
      <template v-if="!isAcademic"><div class="prose-blog post-sheet-content" v-html="renderedContent" /></template>
      <div v-else class="academic-reader">
        <section v-for="(page, index) in academicPages" :key="index" class="academic-paper">
          <header class="academic-paper__header"><span>Atoman</span><span :title="post.title">{{ post.title }}</span></header>
          <div class="academic-paper__body prose-blog prose-blog-academic" v-html="page" />
          <footer class="academic-paper__footer"><span>发布 {{ formatAcademicDate(post.created_at) }}</span><span>第 {{ index + 1 }} 页</span><span>更新 {{ formatAcademicDate(post.updated_at) }}</span></footer>
        </section>
      </div>
      <PostRatingControl :rating-score="post.rating_score" :rating-count="post.rating_count" :viewer-rating="post.viewer_rating" :disabled="!authStore.isAuthenticated" :loading="ratingLoading" :error-message="ratingError" @rate="ratePost" @clear="clearPostRating" />
      <div class="post-sheet-actions-row">
        <PDropdown v-if="isSheet && !bookmarked" position="right">
          <template #trigger><PButton variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="loadBookmarkFolders"><Bookmark :size="15" aria-hidden="true" />收藏</PButton></template>
          <template #default="{ close }"><div class="post-bookmark-menu"><button v-for="folder in bookmarkFolders" :key="folder.id" type="button" @click="addBookmark(folder.id).then(saved => saved && close())">{{ folder.name }}</button><form @submit.prevent="createBookmarkFolder(close)"><input v-model="newBookmarkFolderName" aria-label="新收藏夹名称" placeholder="新建收藏夹" /><PButton size="sm" type="submit" :loading="creatingBookmarkFolder">新建</PButton></form></div></template>
        </PDropdown>
        <PButton v-else variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="toggleBookmark"><Bookmark :size="15" aria-hidden="true" />{{ bookmarked ? '取消收藏' : '收藏' }}</PButton>
        <PButton variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="toggleReadingList"><Clock :size="15" aria-hidden="true" />{{ isInReadingList ? '取消稍后阅读' : '稍后阅读' }}</PButton>
        <PButton variant="secondary" size="sm" @click="sharePost">分享</PButton>
        <a v-if="!isSheet && post.user?.username" :href="api.rss.user(post.user.username)" target="_blank" class="a-link post-detail-toolbar__rss">RSS ↗</a>
      </div>
      <BlogRelatedPosts :items="relatedPosts" @select="openRelatedPost" />
    </article>
    <PDiscussionFAB v-if="post && isActiveSheet && !commentsOpen" :count="activeCommentCount" @click="openComments" />
  </div>
  <CommentSideSheet v-if="post" :show="commentsOpen" :title="commentSheetTitle" :index="isSheet ? layerIndex + 1 : undefined" :partial-anchor="isSheet ? undefined : postContentAnchor" :target="{ kind: 'blog_post', resourceId: post.id }" :can-delete="canDeleteAllComments" @close="closeComments" @activate="closeComments" @mode-change="commentSheetMode = $event" @count-change="commentCount = $event; interactions.commentCount.value = $event" />
</template>

<style scoped>
.blog-post-reader--page { max-width: 64rem; margin: 0 auto; padding-bottom: 12rem; }
.blog-post-reader--page .post-reader-article { padding: 1.5rem 1.5rem 6rem; }
.post-reader-loading, .post-reader-article { padding: 2rem 1.5rem 6rem; }
.post-reader-loading { max-width: 52rem; margin: 0 auto; }
.post-reader-title-skeleton { width: 75%; height: 2.75rem; margin-bottom: 2rem; }
.post-reader-line-skeleton { height: 1rem; margin-bottom: 0.75rem; }
.post-reader-error { padding: 6rem 1.5rem; text-align: center; }
.post-reader-error__code { margin-bottom: 1rem; color: var(--a-color-disabled-border); font-size: 3rem; font-weight: 500; }
.post-reader-error__actions { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
.post-reader-breadcrumb { display: inline-block; margin-bottom: 1.5rem; }
.post-sheet-actions, .post-sheet-byline { display: flex; align-items: center; gap: 1rem; width: 100%; }
.post-sheet-actions { justify-content: flex-end; margin-bottom: 1rem; }
.post-sheet-actions-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-top: 1rem; }
.post-detail-toolbar__rss { margin-left: auto; white-space: nowrap; }
.post-sheet-detail-toolbar { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 1rem; margin: 0 0 1.5rem; }
.post-sheet-cover { width: 100%; max-height: 22rem; margin-bottom: 2rem; object-fit: cover; }
.post-sheet-byline { align-items: flex-start; margin-bottom: 1rem; }
.post-sheet-author-info { min-width: 0; }
.post-sheet-author-row, .post-sheet-publishing-meta { display: flex; align-items: baseline; gap: 0.45rem; min-width: 0; }
.post-sheet-author { overflow: hidden; color: var(--a-color-fg); font-size: 0.9rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.post-sheet-author-handle, .post-sheet-publishing-meta { color: var(--a-color-muted); font-size: 0.78rem; }
.post-sheet-author-handle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.post-sheet-publishing-meta { margin-top: 0.2rem; }
.post-sheet-subscribe { margin-left: auto; padding: 0.35rem 0.65rem; border: 1px solid var(--a-color-border-soft); background: transparent; color: var(--a-color-fg); font-size: 0.78rem; cursor: pointer; text-decoration: none; }
.post-sheet-subscribe.is-subscribed { color: var(--a-color-success); border-color: color-mix(in srgb, var(--a-color-success) 45%, var(--a-color-border-soft)); }
.post-sheet-subscribe:disabled { cursor: wait; opacity: 0.6; }
.post-reader-article h1 { margin: 1rem 0; font-size: clamp(1.8rem, 4vw, 2.8rem); line-height: 1.2; letter-spacing: 0; }
.post-sheet-summary { margin: 0 0 2rem; color: var(--a-color-muted); font-size: 1.05rem; line-height: 1.7; }
.post-sheet-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-right: auto; }
.post-sheet-tags button { border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); color: var(--a-color-fg); cursor: pointer; font-size: 0.78rem; line-height: 1.2; padding: 0.35rem 0.6rem; }
.post-sheet-tags button:hover { border-color: var(--a-color-primary); color: var(--a-color-primary); }
.post-sheet-content { max-width: 46rem; margin: 0 auto; }
.prose-blog :deep(h1), .prose-blog :deep(h3), .prose-blog :deep(h4) { font-weight: 500; letter-spacing: 0; margin: 2rem 0 1rem; line-height: 1.25; }
.prose-blog :deep(h1) { font-size: 2rem; }
.prose-blog :deep(h2) { font-size: 1.5rem; border-left: 2px solid var(--a-color-fg); padding-left: 0.75rem; }
.prose-blog :deep(h3) { font-size: 1.2rem; }
.prose-blog :deep(p) { margin: 1rem 0; line-height: 1.8; font-size: 1.05rem; color: var(--a-color-fg); }
.prose-blog :deep(a) { font-weight: 500; text-decoration: underline; }
.prose-blog :deep(a:hover) { opacity: 0.7; }
.prose-blog :deep(code) { background: var(--a-color-disabled-bg); border: 1px solid var(--a-color-disabled-border); padding: 0.15em 0.4em; font-size: 0.9em; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
.prose-blog :deep(pre) { background: #181825; color: #cdd6f4; padding: 1.25rem; border-radius: var(--a-radius-control); border: 1px solid var(--a-color-border-soft); overflow-x: auto; margin: 1.75rem 0; box-shadow: none; }
.prose-blog :deep(pre code) { background: none; border: none; padding: 0; color: inherit; }
.prose-blog :deep(blockquote) { border-left: 3px solid var(--a-color-primary, #3b82f6); padding: 0.75rem 1.25rem; margin: 1.75rem 0; border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0; font-style: italic; color: var(--a-color-muted); background: color-mix(in srgb, var(--a-color-primary, #3b82f6) 5%, var(--a-color-surface-muted, rgba(255, 255, 255, 0.04))); }
.prose-blog :deep(ul), .prose-blog :deep(ol) { padding-left: 1.5rem; margin: 1rem 0; line-height: 1.8; }
.prose-blog :deep(li) { margin: 0.4rem 0; }
.prose-blog :deep(img) { border-radius: var(--a-radius-control); border: 1px solid var(--a-color-border-soft); width: 100%; margin: 1.75rem 0; box-shadow: none; }
.prose-blog :deep(hr) { border: 0; border-top: 1px solid var(--a-color-border-soft); margin: 2.25rem 0; }
.prose-blog :deep(table) { border-collapse: collapse; width: 100%; margin: 1.75rem 0; border-radius: var(--a-radius-control); overflow: hidden; }
.prose-blog :deep(th), .prose-blog :deep(td) { border: 1px solid var(--a-color-border-soft); padding: 0.7rem 1.1rem; }
.prose-blog :deep(th) { background: var(--a-color-surface-muted); color: var(--a-color-fg); font-weight: 600; text-align: left; }
.academic-reader { display: grid; gap: 1.5rem; margin-top: 1rem; }
.academic-paper { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(100%, 42rem); aspect-ratio: 210 / 297; margin: 0 auto; padding: 1.25rem 1.5rem 1rem; background: #ffffff; color: #171717; box-shadow: 0 1px 3px rgb(0 0 0 / 12%); }
.academic-paper__header, .academic-paper__footer { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.75rem; color: #616161; font-family: Georgia, 'Times New Roman', serif; font-size: 0.72rem; line-height: 1.25; }
.academic-paper__header { min-height: 1.8rem; border-bottom: 1px solid #bdbdbd; }
.academic-paper__header > :last-child { grid-column: 3; overflow: hidden; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.academic-paper__body { min-height: 0; overflow: hidden; column-count: 2; column-gap: 2rem; column-rule: none; font-family: Georgia, 'Times New Roman', serif; font-size: 0.92rem; line-height: 1.68; text-align: justify; }
.academic-paper__body :deep(h1), .academic-paper__body :deep(h2), .academic-paper__body :deep(h3), .academic-paper__body :deep(h4), .academic-paper__body :deep(blockquote), .academic-paper__body :deep(pre), .academic-paper__body :deep(table), .academic-paper__body :deep(img) { break-inside: avoid; }
.academic-paper__body :deep(p) { margin: 0 0 0.9rem; text-indent: 0; }
.academic-paper__footer { min-height: 2rem; margin-top: 1.25rem; border-top: 1px solid #bdbdbd; }
.academic-paper__footer > :first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.academic-paper__footer > :nth-child(2) { grid-column: 2; text-align: center; white-space: nowrap; }
.academic-paper__footer > :last-child { grid-column: 3; overflow: hidden; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.prose-blog-academic { font-family: 'Times New Roman', Times, Georgia, 'Liberation Serif', serif !important; font-size: 0.95rem !important; line-height: 1.65 !important; text-align: justify; }
.prose-blog-academic :deep(h1), .prose-blog-academic :deep(h2), .prose-blog-academic :deep(h3), .prose-blog-academic :deep(h4) { break-inside: avoid; margin-top: 1.5rem !important; margin-bottom: 0.75rem !important; font-weight: 500 !important; letter-spacing: 0; }
.prose-blog-academic :deep(h2) { border-left: none !important; padding-left: 0 !important; border-bottom: 1px solid currentColor !important; padding-bottom: 0.15rem !important; }
.prose-blog-academic :deep(p) { font-size: 0.95rem !important; margin: 0 0 1rem !important; text-indent: 0 !important; line-height: 1.65 !important; }
.prose-blog-academic :deep(blockquote), .prose-blog-academic :deep(pre), .prose-blog-academic :deep(table), .prose-blog-academic :deep(img) { break-inside: avoid; }
.prose-blog :deep(.katex-display) { margin: 1.5rem 0; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
.prose-blog :deep(.katex-display::-webkit-scrollbar) { display: none; }
.prose-blog :deep(.katex) { font-size: 1.05rem; }
@media (max-width: 640px) {
  .post-reader-loading, .post-reader-article { padding: 1.25rem 1rem 5rem; }
  .academic-paper { aspect-ratio: auto; padding: 1rem; }
  .academic-paper__body { column-count: 1; }
  .academic-paper__footer { grid-template-columns: minmax(0, 1fr) auto; }
  .academic-paper__footer > :last-child { display: none; }
  .post-sheet-byline { flex-wrap: wrap; }
  .post-sheet-subscribe { margin-left: 2.5rem; }
  .post-detail-toolbar__rss { margin-left: auto; }
}
@media (max-width: 639px) {
  .prose-blog :deep(pre) { padding: 1rem; font-size: 0.8rem; }
  .prose-blog :deep(h2) { font-size: 1.25rem; }
}
</style>
