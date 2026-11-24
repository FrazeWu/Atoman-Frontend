<script setup lang="ts">
import '@/assets/editor.css'
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Bookmark, Check, Clock, Pencil, MessageSquare, ListTree, Share2 } from 'lucide-vue-next'

import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PToast from '@/components/ui/PToast.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import BlogRelatedPosts, { type BlogRelatedPost } from '@/components/blog/BlogRelatedPosts.vue'
import BlogMediaContent from '@/components/blog/BlogMediaContent.vue'
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
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
import { resolveMediaImageURL, resolveMediaURL } from '@/utils/mediaUrl'

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
  post?: Post | null
}>(), {
  presentation: 'page',
  layerKey: '',
  layerIndex: 0,
  stackSize: 1,
  collectionId: undefined,
  post: null,
})

const isSheet = computed(() => props.presentation === 'sheet')
const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
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
const bookmarkFolderError = ref('')
const publicTagInput = ref('')
const publicTagLoading = ref(false)
const publicTagError = ref('')
const showAddTagInput = ref(false)

async function handleAddTagSubmit() {
  await addPublicTag()
  if (!publicTagError.value) {
    showAddTagInput.value = false
  }
}
const reportOpen = ref(false)
const reportReason = ref('spam')
const reportNote = ref('')
const reportLoading = ref(false)
const reportMessage = ref('')

const outlineOpen = ref(false)
const directoryCollapsed = ref(typeof window !== 'undefined' ? window.innerWidth < 1200 : false)
const mobileDirectoryOpen = ref(false)
const activeHeadingId = ref<string>('')
let headingObserver: IntersectionObserver | null = null

type HeadingItem = {
  id: string
  level: number
  text: string
}

const normalizeTitleText = (text: string) => text.trim().replace(/\s+/g, ' ')

const outlineHeadings = computed<HeadingItem[]>(() => {
  const content = post.value?.content
  if (!content) return []
  const title = normalizeTitleText(post.value?.title || '')
  const matches = Array.from(content.matchAll(/^#{1,4}\s+(.+)$/gm))
  return matches
    .map(m => {
      const rawText = m[1].trim()
      const id = rawText
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-|-$/g, '')
      const levelMatch = m[0].match(/^(#{1,4})/)
      return {
        id,
        level: levelMatch ? levelMatch[1].length : 2,
        text: rawText,
      }
    })
    .filter((h, idx) => {
      // 排除与整篇长文主标题完全重复的标题项，避免目录第一项冗余
      if (idx === 0 && h.level === 1) return false
      if (normalizeTitleText(h.text) === title) return false
      return true
    })
})

const directoryItems = computed(() =>
  outlineHeadings.value.map(h => ({
    id: h.id,
    label: h.text,
    level: h.level,
  }))
)

const displayPublicTags = computed(() => {
  if (!Array.isArray(post.value?.public_tags)) return []
  return post.value.public_tags.filter((t): t is NonNullable<Post['public_tags']>[number] =>
    Boolean(t && typeof t === 'object' && typeof t.name === 'string' && t.name.trim().length > 0)
  )
})

function updateActiveHeadingOnScroll() {
  if (!outlineHeadings.value.length) return
  const headings = document.querySelectorAll<HTMLElement>('.prose-blog h1[id], .prose-blog h2[id], .prose-blog h3[id], .prose-blog h4[id]')
  if (!headings.length) return

  const scrollY = window.scrollY || document.documentElement.scrollTop
  const offset = 140

  let currentId = headings[0].id
  for (let i = 0; i < headings.length; i++) {
    const el = headings[i]
    if (el.offsetTop - offset <= scrollY) {
      currentId = el.id
    } else {
      break
    }
  }
  if (currentId) {
    activeHeadingId.value = currentId
  }
}

function setupHeadingObserver() {
  if (headingObserver) {
    headingObserver.disconnect()
    headingObserver = null
  }

  if (outlineHeadings.value.length > 0 && !activeHeadingId.value) {
    activeHeadingId.value = outlineHeadings.value[0].id
  }

  if (typeof IntersectionObserver === 'undefined') return

  const root = postContentAnchor.value
  if (!root) return

  const headings = root.querySelectorAll<HTMLElement>('.prose-blog h1[id], .prose-blog h2[id], .prose-blog h3[id], .prose-blog h4[id]')
  if (!headings.length) return

  headingObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
      if (visible.length > 0) {
        const topMost = visible.reduce((prev, curr) =>
          prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr
        )
        if (topMost.target.id) {
          activeHeadingId.value = topMost.target.id
        }
      }
    },
    {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    }
  )

  headings.forEach((h) => headingObserver!.observe(h))
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeHeadingId.value = id
    mobileDirectoryOpen.value = false
    outlineOpen.value = false
  }
}

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

const isActiveSheet = computed(() => !isSheet.value || !props.layerKey || sheets.layers.value.length === 0 || sheets.isActive(props.layerKey))

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
    interactiveMedia: true,
  })
})

const ACADEMIC_PAGE_LENGTH = 1_700

function paginateAcademicContent(content: string) {
  if (!content) return []
  const documentFragment = document.implementation.createHTMLDocument('academic-reader')
  documentFragment.body.innerHTML = content
  const root = documentFragment.body
  const sanitizeRoot = root.querySelector(':scope > [data-atoman-sanitize-root]')
  const blocks = Array.from((sanitizeRoot ?? root).children)
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

const publicationDate = computed(() => post.value?.published_at || post.value?.created_at || '')

const formattedPublicationDate = computed(() => {
  if (!publicationDate.value) return ''
  const d = new Date(publicationDate.value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN')
})

function formatAcademicDate(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN')
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

async function recordLifecycleEvent(
  contentId: string,
  event: 'open' | 'engaged' | 'complete',
  source: string,
) {
  try {
    await lifecycle.recordEvent({ module: 'blog', content_id: contentId, event, source })
    if (event === 'open' && authStore.isAuthenticated) {
      await feedStore.fetchSubscriptionHubTree()
    }
  } catch {
    // 阅读事件失败不应影响文章阅读。
  }
}

function startReadingTracking(contentId: string, source: string) {
  consumptionTracker = createContentConsumptionTracker({
    onEvent: event => void recordLifecycleEvent(contentId, event, source),
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
    void loadPublicTags(requestedId)
    commentCount.value = detail.comments_count ?? detail.comment_count ?? 0
    interactions.liked.value = detail.liked ?? detail.is_liked ?? false
    interactions.likeCount.value = detail.likes_count ?? detail.like_count ?? 0
    interactions.commentCount.value = commentCount.value

    if (isSheet.value) {
      void recordLifecycleEvent(detail.id, 'open', 'blog_sheet')
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
    void loadMediaEmbeds(detail.content, authStore.token ?? undefined).catch((error) => {
      reportError(error, 'Failed to load blog media embeds:')
    })

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
    return items.some((item: { content_id?: string; post_id?: string }) => (item.content_id || item.post_id) === contentId)
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
  if (!post.value || !requireLogin() || ratingLoading.value) return
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
  if (!post.value || !requireLogin() || ratingLoading.value) return
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
  bookmarkFolderError.value = ''
  bookmarkFoldersLoading.value = true
  try {
    const response = await apiRequestResult(`${api.url}/blog/bookmark-folders`, { headers: authHeaders() })
    if (response.ok) {
      const payload = response.data as { data?: Array<{ id: string; name: string }> }
      bookmarkFolders.value = payload.data || []
    } else {
      bookmarkFolderError.value = response.error?.message || '收藏夹加载失败，请重试'
    }
  } catch {
    bookmarkFolderError.value = '收藏夹加载失败，请重试'
  } finally {
    bookmarkFoldersLoading.value = false
  }
}

async function addBookmark(folderId: string) {
  if (!post.value) return false
  try {
    const response = await apiRequestResult(`${api.url}/blog/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content_id: post.value.id, bookmark_folder_id: folderId }),
    })
    if (!response.ok) {
      bookmarkFolderError.value = response.error?.message || '收藏失败，请重试'
      return false
    }
    feedStore.bookmarkedPostIds = new Set([...feedStore.bookmarkedPostIds, post.value.id])
    bookmarked.value = true
    return true
  } catch {
    bookmarkFolderError.value = '收藏失败，请重试'
    return false
  }
}

async function createBookmarkFolder(close: () => void) {
  const name = newBookmarkFolderName.value.trim()
  if (!name || creatingBookmarkFolder.value) return
  bookmarkFolderError.value = ''
  creatingBookmarkFolder.value = true
  try {
    const response = await apiRequestResult(`${api.url}/blog/bookmark-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    })
    const payload = response.data as { data?: { id: string; name: string } }
    if (!response.ok || !payload.data) {
      bookmarkFolderError.value = response.error?.message || '收藏夹创建失败，请重试'
      return
    }

    bookmarkFolders.value = [...bookmarkFolders.value, payload.data]
    newBookmarkFolderName.value = ''
    if (await addBookmark(payload.data.id)) {
      close()
    } else {
      bookmarkFolderError.value = '收藏夹已创建，但文章收藏失败，请重试'
    }
  } catch {
    bookmarkFolderError.value = '收藏夹创建失败，请重试'
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

async function loadPublicTags(id: string) {
  const response = await apiRequestResult(api.blog.postPublicTags(id), { headers: authHeaders() })
  if (!response.ok) return
  const payload = await Promise.resolve(response.data)
  const tagList = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : [])
  if (post.value && id === post.value.id) post.value.public_tags = tagList as Post['public_tags']
}

async function addPublicTag() {
  if (!post.value || !authStore.isAuthenticated || publicTagLoading.value) return
  const name = publicTagInput.value.trim()
  if (!name) return
  publicTagLoading.value = true
  publicTagError.value = ''
  try {
    const response = await apiRequestResult(api.blog.postPublicTags(post.value.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      publicTagError.value = response.error?.message || '添加标签失败'
      return
    }
    publicTagInput.value = ''
    await loadPublicTags(post.value.id)
  } finally {
    publicTagLoading.value = false
  }
}

async function removePublicTag(tag: NonNullable<Post['public_tags']>[number]) {
  if (!post.value || !authStore.isAuthenticated || publicTagLoading.value) return
  publicTagLoading.value = true
  publicTagError.value = ''
  try {
    const response = await apiRequestResult(api.blog.postPublicTag(post.value.id, tag.id), { method: 'DELETE', headers: authHeaders() })
    if (!response.ok) {
      publicTagError.value = response.error?.message || '移除标签失败'
      return
    }
    await loadPublicTags(post.value.id)
  } finally {
    publicTagLoading.value = false
  }
}

async function reportPost() {
  if (!post.value || !authStore.isAuthenticated || reportLoading.value) return
  reportLoading.value = true
  reportMessage.value = ''
  try {
    const response = await apiRequestResult(api.blog.postReports(post.value.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ reason: reportReason.value, note: reportNote.value.trim() }),
    })
    if (!response.ok) {
      reportMessage.value = response.error?.message || '举报失败'
      return
    }
    reportOpen.value = false
    reportNote.value = ''
    reportMessage.value = '举报已提交，感谢你的反馈'
  } finally {
    reportLoading.value = false
  }
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

  const footnoteLink = target?.closest<HTMLAnchorElement>('a[data-footnote-ref], a[data-footnote-backref]')
  if (footnoteLink) {
    const href = footnoteLink.getAttribute('href')
    if (href && href.startsWith('#')) {
      const id = href.slice(1)
      const scope = event.currentTarget instanceof Element ? event.currentTarget : document
      const findById = (value: string) => scope instanceof Document
        ? scope.getElementById(value)
        : scope.querySelector<HTMLElement>(`#${CSS.escape(value)}`)
      const targetEl = findById(id) || findById(decodeURIComponent(id))
      if (targetEl) {
        event.preventDefault()
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        targetEl.classList.add('footnote-target-highlight')
        setTimeout(() => {
          targetEl.classList.remove('footnote-target-highlight')
        }, 1500)
      }
    }
    return
  }

  const link = target?.closest<HTMLAnchorElement>('a[data-atoman-embed]')
  const href = link?.getAttribute('href')
  if (!link || !href || href.startsWith('#')) return
  event.preventDefault()
  void router.push(href)
}

watch(() => props.postId, () => { void fetchPost() }, { immediate: true })

watch(renderedContent, () => {
  nextTick(() => {
    setupHeadingObserver()
    updateActiveHeadingOnScroll()
  })
})

onMounted(() => {
  if (!isSheet.value) {
    window.addEventListener('scroll', trackReadingProgress, { passive: true })
    window.addEventListener('scroll', updateActiveHeadingOnScroll, { passive: true })
  }
  nextTick(() => {
    setupHeadingObserver()
    updateActiveHeadingOnScroll()
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', trackReadingProgress)
  window.removeEventListener('scroll', updateActiveHeadingOnScroll)
  if (headingObserver) {
    headingObserver.disconnect()
    headingObserver = null
  }
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
      <p class="post-reader-error__title">文章不存在或已下架</p>
      <p class="a-muted">该内容可能已被删除或移动</p>
      <div class="post-reader-error__actions"><RouterLink to="/posts" class="a-link">返回文章列表</RouterLink></div>
    </div>
    <div v-else-if="!isSheet && errorStatus === 403" class="post-reader-error">
      <p class="post-reader-error__title">该文章尚未发布</p>
      <p class="a-muted">当前内容仅作者或拥有权限的用户可见</p>
      <div class="post-reader-error__actions">
        <RouterLink v-if="authStore.isAuthenticated" :to="`/studio/blog/${postId}/edit`" class="a-link">去编辑 →</RouterLink>
        <RouterLink to="/posts" class="a-link">返回文章列表</RouterLink>
      </div>
    </div>
    <div v-else-if="!isSheet && errorStatus" class="post-reader-error">
      <p class="post-reader-error__title">文章暂时无法加载</p>
      <p class="a-muted">请稍后重试，或返回文章列表。</p>
      <div class="post-reader-error__actions"><PButton variant="secondary" size="sm" @click="fetchPost">重试</PButton><RouterLink to="/posts" class="a-link">返回文章</RouterLink></div>
    </div>
    <div v-else-if="post" class="post-reader-frame">
      <article ref="postContentAnchor" class="post-reader-article" @click="handleRenderedContentClick">
        <div v-if="!isSheet || isOwner" class="post-reader-top-nav">
          <RouterLink v-if="!isSheet" to="/posts" class="a-link post-reader-breadcrumb">← 文章</RouterLink>
          <div v-if="isOwner" class="post-sheet-actions">
            <RouterLink v-if="!isSheet" :to="`/studio/blog/${post.id}/edit`" class="a-btn a-btn--sm a-btn--secondary">编辑</RouterLink>
            <PButton v-else variant="secondary" size="sm" @click="editPost"><Pencil :size="15" aria-hidden="true" />编辑</PButton>
          </div>
        </div>
        <div class="article-eyebrow post-sheet-byline">
          <div class="post-sheet-byline-left">
            <PAvatar class="post-sheet-author-avatar" :src="post.user?.avatar_url" :name="authorName" :alt="`${authorName} 的头像`" size="sm" />
            <div class="post-sheet-author-info">
              <div class="post-sheet-author-row"><span class="post-sheet-author">{{ authorName }}</span><span v-if="authorHandle" class="post-sheet-author-handle">{{ authorHandle }}</span></div>
              <div class="post-sheet-publishing-meta"><span v-if="formattedPublicationDate">发布于 {{ formattedPublicationDate }}</span><span v-if="formattedPublicationDate" aria-hidden="true" class="article-eyebrow__sep">·</span><span class="post-sheet-reading-time">{{ readingTime }}</span></div>
            </div>
          </div>
          <div class="post-sheet-byline-actions">
            <PButton
              v-if="post.channel_id && authStore.isAuthenticated"
              :variant="channelSubscribed ? 'secondary' : 'primary'"
              size="sm"
              class="post-byline-subscribe-btn"
              :disabled="channelSubscriptionBusy"
              @click="toggleChannelSubscription"
            >
              {{ channelSubscribed ? '已订阅' : '+ 订阅' }}
            </PButton>
            <RouterLink
              v-else-if="post.channel_id"
              to="/login"
              class="a-btn a-btn--sm a-btn--primary post-byline-subscribe-btn"
            >
              + 订阅
            </RouterLink>
          </div>
        </div>
        <h1 class="article-title article-headline">{{ post.title }}</h1>
        <div class="article-action-strip">
          <div class="article-action-strip__left">
            <PSegmentedControl v-model="readingMode" :options="readingModeOptions" />
          </div>
          <div class="article-action-strip__right">
            <button
              v-if="outlineHeadings.length && !isAcademic"
              type="button"
              class="article-action-btn post-mobile-outline-toggle"
              :class="{ 'is-active': mobileDirectoryOpen }"
              :aria-pressed="mobileDirectoryOpen"
              aria-label="文章目录"
              title="文章目录"
              @click="mobileDirectoryOpen = !mobileDirectoryOpen"
            >
              <ListTree :size="15" aria-hidden="true" />
              <span>目录</span>
            </button>
            <button
              type="button"
              class="article-action-btn"
              data-test="blog-post-quick-bookmark"
              :aria-pressed="bookmarked"
              :aria-label="bookmarked ? '取消收藏' : '收藏'"
              @click="toggleBookmark"
            >
              <Check v-if="bookmarked" :size="15" aria-hidden="true" />
              <Bookmark v-else :size="15" aria-hidden="true" />
              <span>{{ bookmarked ? '已收藏' : '收藏' }}</span>
            </button>
            <button
              type="button"
              class="article-action-btn"
              aria-label="分享文章"
              @click="sharePost"
            >
              <Share2 :size="15" aria-hidden="true" />
              <span>分享</span>
            </button>
          </div>
        </div>
        <div v-if="post.cover_url" class="article-cover">
          <img
            :src="resolveMediaImageURL(post.cover_url, { width: 1200 })"
            :alt="post.title"
            class="post-sheet-cover"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
        </div>
        <p v-if="post.summary" class="post-sheet-summary article-summary">{{ post.summary }}</p>
        <div v-if="post.tags?.length || displayPublicTags.length || authStore.isAuthenticated" class="post-sheet-detail-toolbar">
          <div class="post-sheet-tags" aria-label="文章标签">
            <button v-for="tag in post.tags" :key="`author-${tag}`" type="button" @click="openTag(tag)">{{ tag }}</button>
            <span v-for="tag in displayPublicTags" :key="tag.id" class="post-public-tag">
              <button type="button" @click="openTag(tag.name)">{{ tag.name }} <small>{{ tag.count }}</small></button>
              <button v-if="tag.viewer_added || isOwner || isAdminRole(authStore.user?.role)" type="button" class="post-public-tag__remove" :aria-label="`移除标签 ${tag.name}`" @click.stop="removePublicTag(tag)">×</button>
            </span>
            <button
              v-if="authStore.isAuthenticated && !showAddTagInput"
              type="button"
              class="post-public-tag-toggle-btn"
              aria-label="添加公共标签"
              @click="showAddTagInput = true"
            >
              + 标签
            </button>
          </div>
          <form v-if="authStore.isAuthenticated && showAddTagInput" class="post-public-tag-form" @submit.prevent="handleAddTagSubmit">
            <input v-model="publicTagInput" maxlength="48" placeholder="添加公共标签" aria-label="添加公共标签" :disabled="publicTagLoading" />
            <PButton type="submit" size="sm" variant="secondary" :loading="publicTagLoading">添加</PButton>
            <PButton type="button" size="sm" variant="ghost" @click="showAddTagInput = false">取消</PButton>
          </form>
        </div>
        <p v-if="publicTagError" class="post-public-tag-error" role="alert">{{ publicTagError }}</p>

        <BlogPostUpdateNotice :variant="isSheet ? 'compact' : 'default'" :updated-at="post.updated_at" />

        <template v-if="!isAcademic">
          <BlogMediaContent
            class="prose-blog post-sheet-content"
            :html="renderedContent"
            :music-embeds="musicEmbeds"
            :video-embeds="videoEmbeds"
          />
        </template>
        <div v-else class="academic-reader">
          <section v-for="(page, index) in academicPages" :key="index" class="academic-paper">
            <header class="academic-paper__header"><span>Atoman</span><span :title="post.title">{{ post.title }}</span></header>
            <BlogMediaContent
              class="academic-paper__body prose-blog prose-blog-academic"
              :html="page"
              :music-embeds="musicEmbeds"
              :video-embeds="videoEmbeds"
            />
            <footer class="academic-paper__footer"><span>发布 {{ formatAcademicDate(publicationDate) }}</span><span>第 {{ index + 1 }} 页</span><span>更新 {{ formatAcademicDate(post.updated_at) }}</span></footer>
          </section>
        </div>

        <PReferenceCardList
          v-if="post.references?.length"
          :references="post.references"
        />

        <PostRatingControl :rating-score="post.rating_score" :rating-count="post.rating_count" :viewer-rating="post.viewer_rating" :loading="ratingLoading" :error-message="ratingError" @rate="ratePost" @clear="clearPostRating" />
        <div class="post-sheet-actions-row">
          <PDropdown v-if="isSheet && !bookmarked" class="post-bookmark-dropdown" position="right">
            <template #trigger><PButton variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="loadBookmarkFolders"><Bookmark :size="15" aria-hidden="true" />收藏</PButton></template>
            <template #default="{ close }">
              <div class="post-bookmark-menu">
                <div class="post-bookmark-menu__folders" role="group" aria-label="收藏夹列表">
                  <button
                    v-for="folder in bookmarkFolders"
                    :key="folder.id"
                    type="button"
                    class="post-bookmark-menu__folder"
                    :disabled="creatingBookmarkFolder"
                    @click="addBookmark(folder.id).then(saved => saved && close())"
                  >
                    {{ folder.name }}
                  </button>
                  <p v-if="bookmarkFoldersLoading" class="post-bookmark-menu__state" aria-live="polite">正在加载收藏夹...</p>
                </div>
                <form class="post-bookmark-menu__create-form" @submit.prevent="createBookmarkFolder(close)">
                  <div class="post-bookmark-menu__create-row">
                    <input
                      v-model="newBookmarkFolderName"
                      aria-label="新收藏夹名称"
                      placeholder="新建收藏夹"
                      maxlength="80"
                      :disabled="creatingBookmarkFolder"
                    />
                    <PButton size="sm" type="submit" variant="secondary" :loading="creatingBookmarkFolder">新建</PButton>
                  </div>
                  <p v-if="bookmarkFolderError" class="post-bookmark-menu__error" role="alert">{{ bookmarkFolderError }}</p>
                </form>
              </div>
            </template>
          </PDropdown>
          <PButton v-else variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="toggleBookmark"><Check v-if="bookmarked" :size="15" aria-hidden="true" /><Bookmark v-else :size="15" aria-hidden="true" />{{ bookmarked ? '取消收藏' : '收藏' }}</PButton>
          <PButton variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="toggleReadingList"><Clock :size="15" aria-hidden="true" />{{ isInReadingList ? '取消稍后阅读' : '稍后阅读' }}</PButton>
          <PButton variant="secondary" size="sm" @click="sharePost">分享</PButton>
          <PButton v-if="authStore.isAuthenticated && !isOwner" variant="ghost" size="sm" @click="reportOpen = !reportOpen">举报</PButton>
          <a v-if="!isSheet && post.user?.username" :href="api.rss.user(post.user.username)" target="_blank" class="a-link post-detail-toolbar__rss">RSS ↗</a>
        </div>
        <form v-if="reportOpen" class="post-report-form" @submit.prevent="reportPost">
          <select v-model="reportReason" aria-label="举报理由">
            <option value="spam">垃圾内容</option>
            <option value="harassment">骚扰或仇恨</option>
            <option value="copyright">版权问题</option>
            <option value="misinformation">错误信息</option>
            <option value="other">其他</option>
          </select>
          <input v-model="reportNote" maxlength="500" placeholder="补充说明（可选）" aria-label="举报补充说明" />
          <PButton type="submit" size="sm" variant="secondary" :loading="reportLoading">提交举报</PButton>
        </form>
        <p v-if="reportMessage" class="post-report-message" role="status">{{ reportMessage }}</p>
        <BlogRelatedPosts :items="relatedPosts" @select="openRelatedPost" />
      </article>

      <!-- 桌面端目录导航悬挂轨：采用专用组件 PDirectoryNav -->
      <aside v-if="directoryItems.length && !isAcademic" class="post-reader-directory-rail" aria-label="文章目录">
        <PDirectoryNav
          v-model:collapsed="directoryCollapsed"
          :items="directoryItems"
          :active-id="activeHeadingId"
          :mobile-open="mobileDirectoryOpen"
          mobile-side="right"
          title="目录"
          aria-label="文章目录"
          @select="scrollToHeading"
          @close-mobile="mobileDirectoryOpen = false"
        />
      </aside>
    </div>
    <div data-test="blog-post-comments-trigger" style="display: contents;">
      <PDiscussionFAB v-if="post && isActiveSheet && !commentsOpen" :count="activeCommentCount" @click="openComments" />
    </div>
  </div>
  <CommentSideSheet v-if="post" :show="commentsOpen" :title="commentSheetTitle" :index="isSheet ? layerIndex + 1 : undefined" :partial-anchor="isSheet ? undefined : postContentAnchor" :target="{ kind: 'blog_post', resourceId: post.id }" :can-delete="canDeleteAllComments" @close="closeComments" @activate="closeComments" @mode-change="commentSheetMode = $event" @count-change="commentCount = $event; interactions.commentCount.value = $event" />
</template>

<style scoped>
@import "./blogPostReader.css";

.academic-reader { display: grid; gap: 1.5rem; margin-top: 1rem; }
.academic-paper { aspect-ratio: 210 / 297; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(100%, 42rem); min-height: 28rem; margin: 0 auto; padding: 1.25rem 1.5rem 1rem; background: var(--a-color-bg, #ffffff); color: var(--a-color-text); border: 1px solid var(--a-color-border-soft); border-radius: 4px; box-shadow: none !important; }
.academic-paper__header, .academic-paper__footer { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.75rem; color: var(--a-color-muted); font-family: Georgia, 'Times New Roman', serif; font-size: 0.72rem; line-height: 1.25; }
.academic-paper__header { min-height: 1.8rem; border-bottom: 1px solid var(--a-color-border-soft); }
.academic-paper__header > :last-child { grid-column: 3; overflow: hidden; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.academic-paper__body { min-height: 0; overflow-y: auto; column-count: 2; column-gap: 2rem; column-rule: none; font-family: Georgia, 'Times New Roman', serif; font-size: 0.92rem; line-height: 1.68; text-align: justify; }
.academic-paper__body :deep(h1), .academic-paper__body :deep(h2), .academic-paper__body :deep(h3), .academic-paper__body :deep(h4), .academic-paper__body :deep(blockquote), .academic-paper__body :deep(pre), .academic-paper__body :deep(table), .academic-paper__body :deep(img) { break-inside: avoid; }
.academic-paper__body :deep(p) { margin: 0 0 0.9rem; text-indent: 0; }
.academic-paper__footer { min-height: 2rem; margin-top: 1.25rem; border-top: 1px solid var(--a-color-border-soft); }
.academic-paper__footer > :first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.academic-paper__footer > :nth-child(2) { grid-column: 2; text-align: center; white-space: nowrap; }
.academic-paper__footer > :last-child { grid-column: 3; overflow: hidden; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.prose-blog-academic { font-family: 'Times New Roman', Times, Georgia, 'Liberation Serif', serif !important; font-size: 0.95rem !important; line-height: 1.65 !important; text-align: justify; }
.prose-blog-academic :deep(h1), .prose-blog-academic :deep(h2), .prose-blog-academic :deep(h3), .prose-blog-academic :deep(h4) { break-inside: avoid; margin-top: 1.5rem !important; margin-bottom: 0.75rem !important; font-weight: 500 !important; letter-spacing: 0; }
.prose-blog-academic :deep(h2) { border-left: none !important; padding-left: 0 !important; border-bottom: 1px solid currentColor !important; padding-bottom: 0.15rem !important; }
.prose-blog-academic :deep(p) { font-size: 0.95rem !important; margin: 0 0 1rem !important; text-indent: 0 !important; line-height: 1.65 !important; }
.prose-blog-academic :deep(blockquote), .prose-blog-academic :deep(pre), .prose-blog-academic :deep(table), .prose-blog-academic :deep(img) { break-inside: avoid; }
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
.prose-blog :deep(.katex-display) { margin: 1.5rem 0; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
.prose-blog :deep(.katex-display::-webkit-scrollbar) { display: none; }
.prose-blog :deep(.katex) { font-size: 1.05rem; }
</style>
