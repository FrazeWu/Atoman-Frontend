<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref, watch } from 'vue'
import { IconBookmark as Bookmark, IconClock as Clock, IconPencil as Pencil } from '@tabler/icons-vue'
import { useRouter } from 'vue-router'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import BlogRelatedPosts, { type BlogRelatedPost } from '@/components/blog/BlogRelatedPosts.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useContentLifecycle } from '@/composables/useContentLifecycle'
import { useFeedStore } from '@/stores/feed'
import { isAdminRole } from '@/utils/roles'
import { useBlogSheetNavigation } from '@/composables/useBlogSheetNavigation'
import type { Post } from '@/types'
import type { BlogPostLayer } from '@/components/blog/blogSheetTypes'

const props = withDefaults(defineProps<{
  layer: BlogPostLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const api = useApi()
const authStore = useAuthStore()
const router = useRouter()
const sheets = useBlogSheets()
const lifecycle = useContentLifecycle()
const { renderMarkdown } = useMarkdownRenderer()

const post = ref<Post | null>(null)
const relatedPosts = ref<BlogRelatedPost[]>([])
const loading = ref(false)
const errorMessage = ref('')
const readingMode = ref<'single' | 'double'>('single')
const isAcademic = computed(() => readingMode.value === 'double')
const readingModeOptions: Array<{ label: string; value: 'single' | 'double'; test: string }> = [
  { label: '单栏', value: 'single', test: 'post-reading-single' },
  { label: '双栏', value: 'double', test: 'post-reading-double' },
]
const renderedContent = computed(() => renderMarkdown(post.value?.content || '', { references: post.value?.references }))
const academicPages = computed(() => paginateAcademicContent(renderedContent.value))
const authorName = computed(() => post.value?.user?.display_name || post.value?.user?.username || '未知作者')
const authorHandle = computed(() => post.value?.user?.username ? `@${post.value.user.username}` : '')
const readingTime = computed(() => {
  const plainText = (post.value?.content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~=-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `约 ${Math.max(1, Math.ceil(plainText.length / 400))} 分钟阅读`
})
const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)
const feedStore = useFeedStore()
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const bookmarkFolders = ref<Array<{ id: string; name: string }>>([])
const bookmarkFoldersLoading = ref(false)
const newBookmarkFolderName = ref('')
const creatingBookmarkFolder = ref(false)
const ratingLoading = ref(false)
const ratingError = ref('')
const commentsOpen = ref(false)
const commentSheetMode = ref<'full' | 'partial'>('partial')
const commentsBlockParent = computed(() => commentsOpen.value && commentSheetMode.value === 'full')
const commentCount = ref<number | undefined>(undefined)
const canDeleteAllComments = computed(() => Boolean(isOwner.value || isAdminRole(authStore.user?.role)))
const commentSheetTitle = computed(() => `博客文章评论-${post.value?.title || '未命名'}`)
const postId = computed(() => props.layer.payload.postId)
const replaceCurrentPost = (id: string) => sheets.replacePost(id, '文章', props.layer.payload.collectionId)
const isTopSheet = computed(() => sheets.isTop(props.layer.key) && !commentsBlockParent.value)
const { navigation, loading: navigationLoading, direction: navigationDirection, navigate } = useBlogSheetNavigation('post', postId, replaceCurrentPost, isTopSheet)
let loadSequence = 0
let relatedRequestSequence = 0

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

function formatAcademicDate(value?: string) {
  if (!value) return '未记录'
  return new Date(value).toLocaleDateString('zh-CN')
}

async function loadPost() {
  const requestedPostId = props.layer.payload.postId
  const requestSequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  post.value = null
  relatedPosts.value = []
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
  commentCount.value = undefined
  readingMode.value = 'single'
  relatedRequestSequence += 1
  channelSubscribed.value = false
  channelSubscriptionBusy.value = false
  try {
    const res = await apiRequestResult(api.blog.post(requestedPostId), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    if (!res.ok) throw new Error('load failed')
    const payload = await Promise.resolve(res.data)
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    const loadedPost = (payload.data || payload) as Post
    post.value = loadedPost
    void lifecycle.recordEvent({
      module: 'blog',
      content_id: loadedPost.id,
      event: 'open',
      source: 'blog_sheet',
    }).catch(() => undefined)
    void loadRelatedPosts(requestedPostId)
    if (authStore.isAuthenticated && post.value?.channel_id) {
      const nextSubscribed = await feedStore.isSubscribedToChannel(post.value.channel_id)
      if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
      channelSubscribed.value = nextSubscribed
    }
  } catch {
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    post.value = null
    errorMessage.value = '文章加载失败，请重试'
  } finally {
    if (requestSequence === loadSequence && requestedPostId === props.layer.payload.postId) loading.value = false
  }
}

async function loadRelatedPosts(postID: string) {
  const requestSequence = ++relatedRequestSequence
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const res = await apiRequestResult(`${api.blog.relatedPosts(postID)}?limit=6`, { headers })
    if (requestSequence !== relatedRequestSequence || postID !== props.layer.payload.postId || !res.ok) return
    const payload = await Promise.resolve(res.data) as unknown
    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : []
    relatedPosts.value = items.filter((item): item is BlogRelatedPost => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<BlogRelatedPost>
      return typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.target_path === 'string'
    })
  } catch {
    if (requestSequence === relatedRequestSequence && postID === props.layer.payload.postId) relatedPosts.value = []
  }
}

function openRelatedPost(item: BlogRelatedPost) {
  sheets.openPost(item.id, item.title)
}

function openComments() {
  commentSheetMode.value = 'partial'
  commentsOpen.value = true
}

function closeComments() {
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
}

const bookmarked = computed(() => Boolean(post.value?.id && feedStore.bookmarkedPostIds.has(post.value.id)))
const inReadingList = computed(() => Boolean(post.value?.id && feedStore.readingListItemIds.has(post.value.id)))

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

function ratingFailureMessage(error?: { code?: string; message?: string }) {
  const message = error?.message?.trim()
  if (message && error?.code !== 'system.internal_error') return message
  return '评分未保存，请重试'
}

function ratingRequestFailureMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|timeout/i.test(error.message))) {
    return '网络连接失败，请检查网络后重试'
  }
  if (error && typeof error === 'object') {
    const apiError = error as { code?: string; message?: string }
    return ratingFailureMessage(apiError)
  }
  return '评分未保存，请重试'
}

async function ratePost(score: number) {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) {
      ratingError.value = ratingFailureMessage(res.error)
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? post.value.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? post.value.rating_count ?? 0)
    post.value.viewer_rating = Number(summary.viewer_rating ?? score)
  } catch (error) {
    ratingError.value = ratingRequestFailureMessage(error)
  } finally {
    ratingLoading.value = false
  }
}

async function clearPostRating() {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) {
      ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? 0)
    post.value.viewer_rating = undefined
  } catch {
    ratingError.value = '评分未清除，请重试'
  } finally {
    ratingLoading.value = false
  }
}

async function loadBookmarkFolders() {
  if (!authStore.isAuthenticated || bookmarkFoldersLoading.value) return
  bookmarkFoldersLoading.value = true
  try {
    const res = await apiRequestResult(`${api.url}/blog/bookmark-folders`, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (res.ok) {
      const payload = res.data as { data?: Array<{ id: string; name: string }> }
      bookmarkFolders.value = payload.data || []
    }
  } finally {
    bookmarkFoldersLoading.value = false
  }
}

async function addBookmark(folderId: string) {
  if (!post.value) return false
  const res = await apiRequestResult(`${api.url}/blog/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
    body: JSON.stringify({ content_id: post.value.id, bookmark_folder_id: folderId }),
  })
  if (!res.ok) return false
  feedStore.bookmarkedPostIds = new Set([...feedStore.bookmarkedPostIds, post.value.id])
  return true
}

async function createBookmarkFolder(close: () => void) {
  const name = newBookmarkFolderName.value.trim()
  if (!name || creatingBookmarkFolder.value) return
  creatingBookmarkFolder.value = true
  try {
    const res = await apiRequestResult(`${api.url}/blog/bookmark-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ name }),
    })
    const payload = res.data as { data?: { id: string; name: string } }
    if (res.ok && payload.data && await addBookmark(payload.data.id)) {
      bookmarkFolders.value = [...bookmarkFolders.value, payload.data]
      newBookmarkFolderName.value = ''
      close()
    }
  } finally {
    creatingBookmarkFolder.value = false
  }
}

async function toggleBookmark() {
  if (!post.value || !authStore.isAuthenticated) return
  await feedStore.togglePostBookmark(post.value.id)
}

async function toggleReadingList() {
  if (!post.value || !authStore.isAuthenticated) return
  const res = await apiRequestResult(`${api.url}/feed/reading-list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
    },
    body: JSON.stringify({ target_type: 'post', target_id: post.value.id }),
  })
  if (!res.ok) return
  const payload = res.data as { data?: { saved?: boolean }; saved?: boolean }
  const saved = Boolean(payload.data?.saved ?? payload.saved)
  const next = new Set(feedStore.readingListItemIds)
  if (saved) next.add(post.value.id)
  else next.delete(post.value.id)
  feedStore.readingListItemIds = next
}

function editPost() {
  if (!post.value) return
  const query = new URLSearchParams()
  if (post.value.channel_id) query.set('channel', post.value.channel_id)
  if (props.layer.payload.collectionId) query.set('collection', props.layer.payload.collectionId)
  const suffix = query.size ? `?${query.toString()}` : ''
  void router.push(`/studio/blog/${post.value.id}/edit${suffix}`)
}

function openTag(tag: string) {
  void router.push({ path: '/posts', query: { tag } })
}

watch(() => props.layer.payload.postId, () => void loadPost(), { immediate: true })
</script>

<template>
  <PSheet
    :show="sheets.isActive(layer.key)"
    :title="`文章-${post?.title || layer.title || '未命名'}`"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key) || commentsBlockParent"
    :is-top-layer="sheets.isTop(layer.key) && !commentsBlockParent"
    reading-mode
    close-type="both"
    :navigation="navigation"
    :navigation-key="postId"
    :navigation-direction="navigationDirection"
    :navigation-loading="navigationLoading"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
    @navigate="navigate"
  >
    <div v-if="loading" class="post-sheet-loading" aria-label="正在加载文章">
      <div class="a-skeleton post-sheet-title-skeleton" />
      <div v-for="index in 6" :key="index" class="a-skeleton post-sheet-line-skeleton" />
    </div>
    <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage">
      <template #action>
        <PButton variant="secondary" size="sm" @click="loadPost">重试</PButton>
      </template>
    </PEmpty>
    <article v-else-if="post" class="post-sheet-article">
      <div v-if="isOwner" class="post-sheet-actions">
        <PButton variant="secondary" size="sm" @click="editPost">
          <Pencil :size="15" aria-hidden="true" />
          编辑
        </PButton>
      </div>
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.title" class="post-sheet-cover" />
      <div class="post-sheet-byline">
        <PAvatar
          class="post-sheet-author-avatar"
          :src="post.user?.avatar_url"
          :name="authorName"
          :alt="`${authorName} 的头像`"
          size="sm"
        />
        <div class="post-sheet-author-info">
          <div class="post-sheet-author-row">
            <span class="post-sheet-author">{{ authorName }}</span>
            <span v-if="authorHandle" class="post-sheet-author-handle">{{ authorHandle }}</span>
          </div>
          <div class="post-sheet-publishing-meta">
            <span>发布于 {{ new Date(post.created_at).toLocaleDateString('zh-CN') }}</span>
            <span aria-hidden="true">·</span>
            <span class="post-sheet-reading-time">{{ readingTime }}</span>
          </div>
        </div>
        <button
          v-if="post.channel_id && authStore.isAuthenticated"
          type="button"
          class="post-sheet-subscribe"
          :class="{ 'is-subscribed': channelSubscribed }"
          :disabled="channelSubscriptionBusy"
          @click="toggleChannelSubscription"
        >
          {{ channelSubscribed ? '已订阅频道' : '订阅频道' }}
        </button>
        <RouterLink v-else-if="post.channel_id" to="/login" class="post-sheet-subscribe">登录后订阅频道</RouterLink>
      </div>
      <h1>{{ post.title }}</h1>
      <p v-if="post.summary" class="post-sheet-summary">{{ post.summary }}</p>
      <div class="post-sheet-detail-toolbar">
        <div v-if="post.tags?.length" class="post-sheet-tags" aria-label="文章标签">
          <button v-for="tag in post.tags" :key="tag" type="button" @click="openTag(tag)">{{ tag }}</button>
        </div>
        <PSegmentedControl v-model="readingMode" :options="readingModeOptions" />
      </div>
      <BlogPostUpdateNotice variant="compact" :updated-at="post.updated_at" />
      <template v-if="!isAcademic">
        <div class="prose-blog post-sheet-content" v-html="renderedContent" />
      </template>
      <div v-else class="academic-reader">
        <section v-for="(page, index) in academicPages" :key="index" class="academic-paper">
          <header class="academic-paper__header">
            <span>Atoman</span>
            <span :title="post.title">{{ post.title }}</span>
          </header>
          <div class="academic-paper__body prose-blog prose-blog-academic" v-html="page" />
          <footer class="academic-paper__footer">
            <span>发布 {{ formatAcademicDate(post.created_at) }}</span>
            <span>第 {{ index + 1 }} 页</span>
            <span>更新 {{ formatAcademicDate(post.updated_at) }}</span>
          </footer>
        </section>
      </div>
      <PostRatingControl
        :rating-score="post.rating_score"
        :rating-count="post.rating_count"
        :viewer-rating="post.viewer_rating"
        :disabled="!authStore.isAuthenticated"
        :loading="ratingLoading"
        :error-message="ratingError"
        @rate="ratePost"
        @clear="clearPostRating"
      />
      <div class="post-sheet-actions-row">
        <PDropdown v-if="!bookmarked" position="right">
          <template #trigger>
            <PButton variant="secondary" size="sm" :disabled="!authStore.isAuthenticated" @click="loadBookmarkFolders">
              <Bookmark :size="15" aria-hidden="true" />收藏
            </PButton>
          </template>
          <template #default="{ close }">
            <div class="post-bookmark-menu">
              <button v-for="folder in bookmarkFolders" :key="folder.id" type="button" @click="addBookmark(folder.id).then(saved => saved && close())">{{ folder.name }}</button>
              <form @submit.prevent="createBookmarkFolder(close)">
                <input v-model="newBookmarkFolderName" aria-label="新收藏夹名称" placeholder="新建收藏夹" />
                <PButton size="sm" type="submit" :loading="creatingBookmarkFolder">新建</PButton>
              </form>
            </div>
          </template>
        </PDropdown>
        <PButton v-else variant="secondary" size="sm" @click="toggleBookmark">
          <Bookmark :size="15" aria-hidden="true" />取消收藏
        </PButton>
        <PButton
          variant="secondary"
          size="sm"
          :disabled="!authStore.isAuthenticated"
          @click="toggleReadingList"
        >
          <Clock :size="15" aria-hidden="true" />
          {{ inReadingList ? '取消稍后阅读' : '稍后阅读' }}
        </PButton>
      </div>
      <BlogRelatedPosts :items="relatedPosts" @select="openRelatedPost" />
    </article>
    <PDiscussionFAB
      v-if="post && sheets.isActive(layer.key)"
      :count="commentCount"
      @click="openComments"
    />
  </PSheet>

  <CommentSideSheet
    v-if="post"
    :show="commentsOpen"
    :title="commentSheetTitle"
    :index="layerIndex + 1"
    :target="{ kind: 'blog_post', resourceId: post.id }"
    :can-delete="canDeleteAllComments"
    @close="closeComments"
    @activate="closeComments"
    @mode-change="commentSheetMode = $event"
    @count-change="commentCount = $event"
  />
</template>

<style scoped>
.post-sheet-actions,
.post-sheet-byline {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.post-sheet-actions {
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.post-sheet-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}

.post-sheet-detail-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1rem;
  margin: 0 0 1.5rem;
}

.post-sheet-loading,
.post-sheet-article {
  padding: 2rem 1.5rem 6rem;
}

.post-sheet-title-skeleton {
  width: 75%;
  height: 2.75rem;
  margin-bottom: 2rem;
}

.post-sheet-line-skeleton {
  height: 1rem;
  margin-bottom: 0.75rem;
}

.post-sheet-cover {
  width: 100%;
  max-height: 22rem;
  margin-bottom: 2rem;
  object-fit: cover;
}

.post-sheet-byline {
  align-items: flex-start;
  margin-bottom: 1rem;
}

.post-sheet-author-info {
  min-width: 0;
}

.post-sheet-author-row,
.post-sheet-publishing-meta {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.post-sheet-author {
  overflow: hidden;
  color: var(--a-color-fg);
  font-size: 0.9rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-sheet-author-handle,
.post-sheet-publishing-meta {
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

.post-sheet-author-handle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-sheet-publishing-meta {
  margin-top: 0.2rem;
}

.post-sheet-subscribe {
  margin-left: auto;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-fg);
  font-size: 0.78rem;
  cursor: pointer;
  text-decoration: none;
}

.post-sheet-subscribe.is-subscribed {
  color: var(--a-color-success);
  border-color: color-mix(in srgb, var(--a-color-success) 45%, var(--a-color-border-soft));
}

.post-sheet-subscribe:disabled {
  cursor: wait;
  opacity: 0.6;
}

.post-sheet-article h1 {
  margin: 1rem 0;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.2;
  letter-spacing: 0;
}

.post-sheet-summary {
  margin: 0 0 2rem;
  color: var(--a-color-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.post-sheet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-right: auto;
}

.post-sheet-tags button {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1.2;
  padding: 0.35rem 0.6rem;
}

.post-sheet-tags button:hover {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.post-sheet-content {
  max-width: 46rem;
  margin: 0 auto;
}

.academic-reader {
  display: grid;
  gap: 1.5rem;
  margin-top: 1rem;
}

.academic-paper {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(100%, 42rem);
  aspect-ratio: 210 / 297;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 1rem;
  background: #ffffff;
  color: #171717;
  box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
}

.academic-paper__header,
.academic-paper__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  color: #616161;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 0.72rem;
  line-height: 1.25;
}

.academic-paper__header {
  min-height: 1.8rem;
  border-bottom: 1px solid #bdbdbd;
}

.academic-paper__header > :last-child {
  grid-column: 3;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.academic-paper__body {
  min-height: 0;
  overflow: hidden;
  column-count: 2;
  column-gap: 2rem;
  column-rule: none;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 0.92rem;
  line-height: 1.68;
  text-align: justify;
}

.academic-paper__body :deep(h1),
.academic-paper__body :deep(h2),
.academic-paper__body :deep(h3),
.academic-paper__body :deep(h4),
.academic-paper__body :deep(blockquote),
.academic-paper__body :deep(pre),
.academic-paper__body :deep(table),
.academic-paper__body :deep(img) {
  break-inside: avoid;
}

.academic-paper__body :deep(p) {
  margin: 0 0 0.9rem;
}

.academic-paper__footer {
  min-height: 2rem;
  margin-top: 1.25rem;
  border-top: 1px solid #bdbdbd;
}

.academic-paper__footer > :first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.academic-paper__footer > :nth-child(2) {
  grid-column: 2;
  text-align: center;
  white-space: nowrap;
}

.academic-paper__footer > :last-child {
  grid-column: 3;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .post-sheet-loading,
  .post-sheet-article {
    padding: 1.25rem 1rem 5rem;
  }

  .academic-paper {
    aspect-ratio: auto;
    padding: 1rem;
  }

  .academic-paper__body {
    column-count: 1;
  }

  .academic-paper__footer {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .academic-paper__footer > :last-child {
    display: none;
  }

  .post-sheet-byline {
    flex-wrap: wrap;
  }

  .post-sheet-subscribe {
    margin-left: 2.5rem;
  }
}
</style>
