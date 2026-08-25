<template>
  <div style="padding-bottom:12rem">
    <!-- Loading -->
    <div v-if="loading" class="a-page-md" style="padding-top:4rem">
      <div class="a-skeleton" style="height:3rem;width:75%;margin-bottom:1rem" />
      <div class="a-skeleton" style="height:1rem;width:33%;margin-bottom:1.5rem" />
      <div class="a-skeleton" style="aspect-ratio:16/9;margin-bottom:1.5rem" />
      <div v-for="i in 5" :key="i" class="a-skeleton" style="height:1rem;margin-bottom:.75rem" />
    </div>

    <!-- Not found -->
    <div v-else-if="errorStatus === 404" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:3rem;font-weight: 500;color:var(--a-color-disabled-border);margin-bottom:1rem">404</p>
      <p class="a-muted" style="margin-bottom:1.5rem">文章不存在</p>
      <RouterLink to="/posts" class="a-link">← 返回文章</RouterLink>
    </div>

    <!-- Load error -->
    <div v-else-if="errorStatus && errorStatus !== 403" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:1.2rem;font-weight:600;margin-bottom:0.75rem">文章暂时无法加载</p>
      <p class="a-muted" style="margin-bottom:1.5rem">请稍后重试，或返回文章列表。</p>
      <div style="display:flex;justify-content:center;gap:0.75rem;flex-wrap:wrap">
        <button type="button" class="a-btn a-btn--primary" @click="fetchPost">重试</button>
        <RouterLink to="/posts" class="a-link">返回文章</RouterLink>
      </div>
    </div>

    <!-- Draft (only visible to owner) -->
    <div v-else-if="errorStatus === 403" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:3rem;font-weight: 500;color:var(--a-color-disabled-border);margin-bottom:1rem">草稿</p>
      <p class="a-muted" style="margin-bottom:1.5rem">该文章尚未发布，请登录后查看或编辑</p>
      <RouterLink :to="`/studio/blog/${postId}/edit`" class="a-link">去编辑 →</RouterLink>
    </div>

    <!-- Post content -->
    <article v-else-if="post">
      <PostHeader
        :post="post"
        :is-owner="isOwner"
        :is-academic="isAcademic"
        @toggle-academic="isAcademic = $event"
      />

      <div :class="isAcademic ? 'a-page' : 'a-page-md'">
        <BlogPostUpdateNotice :updated-at="post.updated_at" />

        <!-- Markdown content -->
        <div 
          class="prose-blog" 
          :class="{ 'prose-blog-academic': isAcademic }" 
          style="margin-bottom:3rem" 
          v-html="renderedContent" 
        />

        <!-- Rating and interaction bar -->
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
        <div class="post-detail-toolbar">
          <div class="post-detail-actions">
            <button
              v-if="post.channel_id && authStore.isAuthenticated"
              class="a-toggle-btn"
              :class="{ 'a-toggle-btn-active': channelSubscribed }"
              :disabled="channelSubscriptionBusy"
              @click="toggleChannelSubscription"
            >
              {{ channelSubscribed ? '已订阅频道' : '订阅频道' }}
            </button>
            <RouterLink v-else-if="post.channel_id" to="/login" class="a-toggle-btn">登录后订阅频道</RouterLink>
            <button
              class="a-toggle-btn"
              :class="{ 'a-toggle-btn-active': bookmarked }"
              :disabled="!authStore.isAuthenticated"
              @click="toggleBookmark"
            >
              {{ bookmarked ? '取消收藏' : '收藏' }}
            </button>
            <button
              class="a-toggle-btn"
              :class="{ 'a-toggle-btn-active': isInReadingList }"
              :disabled="!authStore.isAuthenticated"
              @click="toggleReadingList"
            >
              {{ isInReadingList ? '取消稍后阅读' : '稍后阅读' }}
            </button>
            <button class="a-toggle-btn" title="分享" @click="sharePost">
              分享
            </button>
          </div>
          <a
            v-if="post.user?.username"
            :href="api.rss.user(post.user.username)"
            target="_blank"
            class="a-link post-detail-toolbar__rss"
          >
            RSS ↗
          </a>
        </div>

        <!-- Comments -->
        <CommentSection
          :target="{ kind: 'blog_post', resourceId: postId }"
          :can-delete="canDeleteAllComments"
          @count-change="interactions.commentCount.value = $event"
        />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CommentSection from '@/components/comment/CommentSection.vue'
import PostHeader from '@/components/blog/PostHeader.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import { useAuthStore } from '@/stores/auth'
import { userUrl } from '@/composables/useSubdomainNav'
import { useApi } from '@/composables/useApi'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { applyResolvedReferences } from '@/composables/useReferenceRendering'
import { usePageMeta } from '@/composables/usePageMeta'
import { useInteractions } from '@/composables/useInteractions'
import { isAdminRole } from '@/utils/roles'
import type { Post } from '@/types'
import { useSheetStore } from '@/stores/sheet'
import { useFeedStore } from '@/stores/feed'
import { createContentConsumptionTracker, useContentLifecycle } from '@/composables/useContentLifecycle'

type EmbedData = {
  id: string
  title: string
  summary?: string
  meta?: string
  href?: string
}

type PostDetailResponse = Post & {
  liked?: boolean
  is_liked?: boolean
  like_count?: number
  comment_count?: number
}

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const sheetStore = useSheetStore()
const feedStore = useFeedStore()

const postId = computed(() => props.id || String(route.params.id || ''))
const authStore = useAuthStore()
const api = useApi()
const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const { setPageMeta, restorePageMeta } = usePageMeta()
const interactions = useInteractions('blog', 'post', postId)
const lifecycle = useContentLifecycle()

const post = ref<Post | null>(null)
const isAcademic = ref(false)
const loading = ref(true)
const errorStatus = ref<number | null>(null)
const bookmarked = ref(false)
const ratingLoading = ref(false)
const ratingError = ref('')
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const postEmbeds = ref<Record<string, EmbedData>>({})
const musicEmbeds = ref<Record<string, EmbedData>>({})
const videoEmbeds = ref<Record<string, EmbedData>>({})
let loadSeq = 0
let bookmarkOperationSeq = 0
let consumptionTracker: ReturnType<typeof createContentConsumptionTracker> | null = null

const readingSource = () => typeof route.query.source === 'string' ? route.query.source : 'direct'
const trackReadingProgress = () => {
  if (!post.value || !consumptionTracker) return
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? window.scrollY / scrollable : 1
  consumptionTracker.update(progress)
}

const startReadingTracking = (contentID: string, source: string) => {
  consumptionTracker = createContentConsumptionTracker({
    onEvent: event => void lifecycle.recordEvent({ module: 'blog', content_id: contentID, event, source }).catch(() => undefined),
    onProgress: progress => {
      if (!authStore.token) return
      void lifecycle.saveProgress({
        module: 'blog', content_id: contentID, position_sec: 0, duration_sec: 0,
        progress, completed: progress >= 0.95, source,
      }).catch(() => undefined)
    },
  })
  consumptionTracker.open()
  trackReadingProgress()
}

const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)
const isInReadingList = computed(() => Boolean(post.value?.id && feedStore.readingListItemIds.has(post.value.id)))
const canDeleteAllComments = computed(() => Boolean(isOwner.value || isAdminRole(authStore.user?.role)))

const normalizeTitleText = (text: string) => text.trim().replace(/\s+/g, ' ')

const stripLeadingDuplicateHeading = (content: string, title: string) => {
  const lines = content.split('\n')
  if (!lines.length) return content

  const firstLine = lines[0]?.trim() || ''
  const match = firstLine.match(/^#{1,6}\s+(.+)$/)
  if (!match) return content

  const headingText = normalizeTitleText(match[1])
  const postTitle = normalizeTitleText(title)
  if (!headingText || !postTitle || headingText !== postTitle) return content

  let startIndex = 1
  while (startIndex < lines.length && lines[startIndex].trim() === '') {
    startIndex++
  }

  return lines.slice(startIndex).join('\n')
}

const renderedContent = computed(() => {
  // Re-render after the lazily loaded KaTeX and code-highlight extensions are ready.
  void markdownRuntimeState.value
  const content = post.value?.content ?? ''
  const title = post.value?.title ?? ''
  const referencedContent = applyResolvedReferences(content, post.value?.references)
  return renderMarkdown(stripLeadingDuplicateHeading(referencedContent, title), {
    postEmbeds: postEmbeds.value,
    musicEmbeds: musicEmbeds.value,
    videoEmbeds: videoEmbeds.value,
  })
})

const fetchPost = async () => {
  const requestedID = postId.value
  const seq = ++loadSeq
  const isCurrentLoad = () => seq === loadSeq && requestedID === postId.value
  loading.value = true
  errorStatus.value = null
  post.value = null
  isAcademic.value = false
  bookmarked.value = false
  channelSubscribed.value = false
  channelSubscriptionBusy.value = false
  ratingLoading.value = false
  ratingError.value = ''
  postEmbeds.value = {}
  musicEmbeds.value = {}
  videoEmbeds.value = {}
  interactions.liked.value = false
  interactions.likeCount.value = 0
  interactions.commentCount.value = 0
  consumptionTracker = null
  restorePageMeta()
  try {
    if (!requestedID) {
      errorStatus.value = 404
      return
    }
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
    const res = await apiRequestResult(api.blog.post(requestedID), { headers })
    if (!isCurrentLoad()) return
    if (res.ok) {
      const d = await Promise.resolve(res.data)
      if (!isCurrentLoad()) return
      const detail = (d.data || d) as PostDetailResponse
      post.value = detail
      startReadingTracking(detail.id, readingSource())
      interactions.liked.value = detail.liked ?? detail.is_liked ?? false
      interactions.likeCount.value = detail.likes_count ?? detail.like_count ?? 0
      interactions.commentCount.value = detail.comments_count ?? detail.comment_count ?? 0

      if (authStore.isAuthenticated && detail.channel_id) {
        void feedStore.isSubscribedToChannel(detail.channel_id).then((subscribed) => {
          if (isCurrentLoad()) channelSubscribed.value = subscribed
        })
      }

      const description = detail.summary?.trim()
        || detail.content.replace(/[#*`>~_\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
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
          headers: {
            'Content-Type': 'application/json',
            ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
          },
          body: JSON.stringify({
            source_type: 'internal_channel',
            source_id: detail.channel_id,
            event_type: 'detail_open',
          }),
        }).catch(() => {})
      }

      const embeds = await fetchEmbeds(detail.content)
      if (!isCurrentLoad()) return
      postEmbeds.value = embeds.posts
      musicEmbeds.value = embeds.music
      videoEmbeds.value = embeds.videos

      // Initialize bookmark state
      if (authStore.isAuthenticated) {
        const requestBookmarkOperationSeq = bookmarkOperationSeq
        void fetchBookmarkState(detail.id).then((state) => {
          if (
            isCurrentLoad()
            && requestBookmarkOperationSeq === bookmarkOperationSeq
            && state !== null
          ) bookmarked.value = state
        })
        void feedStore.fetchReadingListIds()
      }

      if (props.id === requestedID) {
        sheetStore.updateSheetTitle(requestedID, 'post', detail.title)
      }

    } else {
      errorStatus.value = res.status
      restorePageMeta()
    }
  } catch (e) {
    if (!isCurrentLoad()) return
    reportError(e)
    errorStatus.value = 500
    restorePageMeta()
  } finally {
    if (isCurrentLoad()) loading.value = false
  }
}

watch(postId, () => {
  fetchPost()
})

const fetchBookmarkState = async (postId: string): Promise<boolean | null> => {
  try {
    const res = await apiRequestResult(api.blog.bookmarks, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      const d = await Promise.resolve(res.data)
      const items = d.data || []
      return items.some((b: { post_id: string }) => b.post_id === postId)
    }
    return null
  } catch (e) { reportError(e) }
  return null
}

const toggleBookmark = async () => {
  if (!post.value) return
  const requestedID = post.value.id
  const requestLoadSeq = loadSeq
  const requestOperationSeq = ++bookmarkOperationSeq
  const nextState = await feedStore.togglePostBookmark(requestedID)
  if (
    requestLoadSeq === loadSeq
    && requestOperationSeq === bookmarkOperationSeq
    && postId.value === requestedID
    && post.value?.id === requestedID
    && nextState !== null
  ) bookmarked.value = nextState
}

const toggleReadingList = async () => {
  if (!post.value) return
  await feedStore.toggleReadingListItem(post.value.id)
}

const ratePost = async (score: number) => {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) {
      ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? post.value.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? post.value.rating_count ?? 0)
    post.value.viewer_rating = Number(summary.viewer_rating ?? score)
  } catch (error) {
    reportError(error, 'Failed to rate blog post')
    ratingError.value = '评分未保存，请重试'
  } finally {
    ratingLoading.value = false
  }
}

const clearPostRating = async () => {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'DELETE',
      headers: authHeaders(),
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
  } catch (error) {
    reportError(error, 'Failed to clear blog post rating')
    ratingError.value = '评分未清除，请重试'
  } finally {
    ratingLoading.value = false
  }
}

const toggleChannelSubscription = async () => {
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

const sharePost = async () => {
  if (!post.value) return
  const url = `${window.location.origin}/posts/post/${encodeURIComponent(post.value.id)}`
  const title = post.value?.title || document.title
  const share = navigator.share?.bind(navigator)
  if (share) {
    try {
      await share({ title, text: post.value.summary || '', url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  await navigator.clipboard?.writeText(url)
}

const extractEmbedIds = (content: string, kind: 'post' | 'music' | 'video') => {
  const patternMap = {
    post: /:::post\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    music: /:::music\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    video: /:::video\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
  }

  const matches = content.matchAll(patternMap[kind])
  return [...new Set(Array.from(matches, (match) => match[1]))]
}

const authHeaders = () => {
  const headers: Record<string, string> = {}
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
  return headers
}

const fetchPostEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'post')
  if (!ids.length) return {}

  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await apiRequestResult(api.blog.post(id), { headers: authHeaders() })
        if (!res.ok) return null
        const payload = await Promise.resolve(res.data)
        const embedPost = (payload.data || payload) as Post
        return [
          id,
          {
            id,
            title: embedPost.title,
            summary: embedPost.summary,
            meta: embedPost.channel?.name,
            href: `/posts/post/${id}`,
          } satisfies EmbedData,
        ] as const
      } catch {
        return null
      }
    }),
  )

  return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

const fetchMusicEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'music')
  if (!ids.length) return {}

  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await apiRequestResult(api.v1.music.album(id), { headers: authHeaders() })
        if (!res.ok) return null
        const payload = await Promise.resolve(res.data)
        const album = (payload.data || payload) as import('@/types').Album
        return [
          id,
          {
            id,
            title: album.title,
            summary: album.release_date ? `发行日期：${album.release_date}` : undefined,
            meta: [album.artists?.map((artist) => artist.name).join(' / '), album.year ? String(album.year) : ''].filter(Boolean).join(' · '),
            href: `/music/album/${id}`,
          } satisfies EmbedData,
        ] as const
      } catch {
        return null
      }
    }),
  )

  return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

const fetchVideoEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'video')
  if (!ids.length) return {}

  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        id,
        title: '引用视频',
        summary: '视频模块尚未接入真实数据源，当前为可扩展占位。',
        href: `#video-${id}`,
      } satisfies EmbedData,
    ]),
  )
}

const fetchEmbeds = async (content: string) => {
  const [posts, music, videos] = await Promise.all([
    fetchPostEmbeds(content),
    fetchMusicEmbeds(content),
    fetchVideoEmbeds(content),
  ])
  return { posts, music, videos }
}

onMounted(() => {
  window.addEventListener('scroll', trackReadingProgress, { passive: true })
  void fetchPost()
})
onUnmounted(() => window.removeEventListener('scroll', trackReadingProgress))
</script>

<style scoped>
.prose-blog :deep(h1),
.prose-blog :deep(h3),
.prose-blog :deep(h4) {
  font-weight: 500;
  letter-spacing: 0;
  margin: 2rem 0 1rem;
  line-height: 1.25;
}
.prose-blog :deep(h1) { font-size: 2rem; }
.prose-blog :deep(h2) { font-size: 1.5rem; border-left: 2px solid var(--a-color-fg); padding-left: 0.75rem; }
.prose-blog :deep(h3) { font-size: 1.2rem; }
.prose-blog :deep(p) { margin: 1rem 0; line-height: 1.8; font-size: 1.05rem; color: var(--a-color-fg); }
.prose-blog :deep(a) { font-weight: 500; text-decoration: underline; }
.prose-blog :deep(a:hover) { opacity: 0.7; }
.prose-blog :deep(code) {
  background: var(--a-color-disabled-bg);
  border: 1px solid var(--a-color-disabled-border);
  padding: 0.15em 0.4em;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.prose-blog :deep(pre) {
  background: #181825;
  color: #cdd6f4;
  padding: 1.25rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  overflow-x: auto;
  margin: 1.75rem 0;
  box-shadow: none;
}
.prose-blog :deep(pre code) { background: none; border: none; padding: 0; color: inherit; }
.prose-blog :deep(blockquote) {
  border-left: 3px solid var(--a-color-primary, #3b82f6);
  padding: 0.75rem 1.25rem;
  margin: 1.75rem 0;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  font-style: italic;
  color: var(--a-color-muted);
  background: color-mix(in srgb, var(--a-color-primary, #3b82f6) 5%, var(--a-color-surface-muted, rgba(255, 255, 255, 0.04)));
}
.prose-blog :deep(ul), .prose-blog :deep(ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
  line-height: 1.8;
}
.prose-blog :deep(li) { margin: 0.4rem 0; }
.prose-blog :deep(img) {
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  width: 100%;
  margin: 1.75rem 0;
  box-shadow: none;
}
.prose-blog :deep(hr) { border: 0; border-top: 1px solid var(--a-color-border-soft); margin: 2.25rem 0; }
.prose-blog :deep(table) { border-collapse: collapse; width: 100%; margin: 1.75rem 0; border-radius: var(--a-radius-control); overflow: hidden; }
.prose-blog :deep(th), .prose-blog :deep(td) { border: 1px solid var(--a-color-border-soft); padding: 0.7rem 1.1rem; }
.prose-blog :deep(th) { background: var(--a-color-surface-muted); color: var(--a-color-fg); font-weight: 600; text-align: left; }

.post-detail-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding: 1.5rem 0;
  margin-bottom: 3rem;
}

.post-detail-toolbar__rss {
  margin-left: auto;
  white-space: nowrap;
}

.post-detail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  min-width: 0;
}

.post-detail-actions .a-toggle-btn {
  border-radius: var(--a-radius-control) !important;
  padding: 0.45rem 1rem !important;
  font-weight: 600 !important;
  font-size: 0.82rem !important;
  transition: transform 0.15s ease, background-color 0.2s ease, border-color 0.2s ease !important;
}

.post-detail-actions .a-toggle-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

@media (max-width: 767px) {
  .post-detail-toolbar {
    align-items: flex-start;
    gap: 0.75rem;
  }

  .post-detail-toolbar :deep(.interaction-bar) {
    flex: 1 1 auto;
  }

  .post-detail-toolbar__rss {
    order: 2;
    margin-left: auto;
    padding-top: 0.35rem;
  }

  .post-detail-actions {
    display: grid;
    order: 3;
    flex: 1 1 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .post-detail-actions .a-toggle-btn {
    min-width: 0;
    min-height: 2.5rem;
    padding: 0.45rem 0.5rem !important;
    white-space: normal;
  }
}

/* KaTeX math rendering */
.prose-blog :deep(.katex-display) { margin: 1.5rem 0; overflow-x: auto; }
.prose-blog :deep(.katex) { font-size: 1.05rem; }

/* highlight.js code theme (inside dark pre) */
.prose-blog :deep(.hljs-keyword),
.prose-blog :deep(.hljs-built_in) { color: #ff79c6; }
.prose-blog :deep(.hljs-string) { color: #f1fa8c; }
.prose-blog :deep(.hljs-number) { color: #bd93f9; }
.prose-blog :deep(.hljs-comment) { color: #6272a4; font-style: italic; }
.prose-blog :deep(.hljs-function),
.prose-blog :deep(.hljs-title) { color: #50fa7b; }
.prose-blog :deep(.hljs-variable),
.prose-blog :deep(.hljs-attr) { color: #8be9fd; }


.prose-blog :deep(.atoman-post-embed) {
  margin: 1.5rem 0;
}
.prose-blog :deep(.atoman-post-embed__link) {
  display: block;
  border: var(--a-border);
  padding: 1rem 1.25rem;
  text-decoration: none;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
}
.prose-blog :deep(.atoman-post-embed__link:hover) {
  box-shadow: var(--a-shadow-dropdown);
}
.prose-blog :deep(.atoman-post-embed__label) {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
  margin-bottom: 0.5rem;
}
.prose-blog :deep(.atoman-post-embed__title) {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 0.4rem;
}
.prose-blog :deep(.atoman-post-embed__summary) {
  font-size: 0.875rem;
  color: var(--a-color-muted);
  line-height: 1.6;
}
.prose-blog :deep(.atoman-post-embed__meta) {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

/* Like / toggle button */
.a-toggle-btn {
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 0.4rem 0.875rem;
  border: var(--a-border);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.a-toggle-btn:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.a-toggle-btn-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.a-toggle-btn-active:hover {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

@media (max-width: 639px) {
  .prose-blog :deep(pre) { padding: 1rem; font-size: 0.8rem; }
  .prose-blog :deep(h2) { font-size: 1.25rem; }
}

/* ─── Academic Header Styles ───────────────────────────────────────────── */
.academic-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 2.25rem;
  font-weight: 500;
  text-align: center;
  margin-top: 2.5rem;
  margin-bottom: 1.5rem;
  letter-spacing: 0;
  color: var(--a-color-fg);
  line-height: 1.2;
}

.normal-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: none;
  margin-bottom: 2.5rem;
}

.academic-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding-bottom: 2rem;
  border-bottom: none;
  margin-bottom: 2.5rem;
  text-align: center;
}

.academic-author {
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  font-weight: 500;
  font-size: 1.15rem;
  color: var(--a-color-fg);
}

.academic-date {
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  font-size: 0.85rem;
  color: var(--a-color-muted);
}

.academic-abstract {
  max-width: 80%;
  margin: 0 auto 3rem auto;
  text-align: justify;
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  line-height: 1.62;
  padding: 1.25rem 1.75rem;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
}

.abstract-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 0.5rem;
  letter-spacing: 0;
}

.abstract-content {
  font-size: 0.9rem;
  color: var(--a-color-fg);
  margin: 0;
}

/* ─── Academic Two-Column (NIPS/NeurIPS style) ───────────────────────────── */
.prose-blog-academic {
  column-count: 2;
  column-gap: 3rem;
  column-rule: 1px solid var(--a-color-border-soft);
  text-align: justify;
  text-justify: inter-word;
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif !important;
  font-size: 0.95rem !important;
  line-height: 1.65 !important;
}

/* Adjust heading styles in academic mode */
.prose-blog-academic :deep(h1),
.prose-blog-academic :deep(h2),
.prose-blog-academic :deep(h3),
.prose-blog-academic :deep(h4) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  break-after: avoid;
  break-inside: avoid;
  margin-top: 1.5rem !important;
  margin-bottom: 0.75rem !important;
  font-weight: 500 !important;
  letter-spacing: 0;
}

.prose-blog-academic :deep(h1) {
  font-size: 1.4rem !important;
  text-align: center;
  margin-top: 2rem !important;
  margin-bottom: 1rem !important;
  column-span: all;
}

.prose-blog-academic :deep(h2) {
  font-size: 1.15rem !important;
  border-left: none !important;
  padding-left: 0 !important;
  text-transform: uppercase;
  letter-spacing: 0;
  border-bottom: 1px solid var(--a-color-fg) !important;
  padding-bottom: 0.15rem !important;
}

.prose-blog-academic :deep(h3) {
  font-size: 1.02rem !important;
  font-style: italic;
  font-weight: 500;
}

.prose-blog-academic :deep(p) {
  font-size: 0.95rem !important;
  margin: 0 0 1rem 0 !important;
  text-indent: 1.5rem;
  line-height: 1.65 !important;
}

/* Do not indent the very first paragraph after a heading or blockquotes/pre/table */
.prose-blog-academic :deep(h2) + :deep(p),
.prose-blog-academic :deep(h3) + :deep(p),
.prose-blog-academic :deep(h4) + :deep(p),
.prose-blog-academic :deep(p):first-of-type,
.prose-blog-academic :deep(blockquote) + :deep(p),
.prose-blog-academic :deep(pre) + :deep(p) {
  text-indent: 0 !important;
}

/* Block elements break prevention */
.prose-blog-academic :deep(blockquote) {
  break-inside: avoid;
  border-left: 3px double var(--a-color-fg) !important;
  background: var(--a-color-surface) !important;
  padding: 0.75rem 1rem !important;
  margin: 1.25rem 0 !important;
  font-family: inherit !important;
  font-style: italic;
  text-indent: 0 !important;
}

.prose-blog-academic :deep(pre) {
  break-inside: avoid;
  margin: 1.25rem 0 !important;
  font-size: 0.82rem !important;
  text-indent: 0 !important;
}

.prose-blog-academic :deep(table) {
  break-inside: avoid;
  margin: 1.5rem 0 !important;
  font-size: 0.82rem !important;
  border-top: 2px solid var(--a-color-fg) !important;
  border-bottom: 2px solid var(--a-color-fg) !important;
  border-collapse: collapse;
}

.prose-blog-academic :deep(th) {
  border: none !important;
  border-bottom: 1px solid var(--a-color-fg) !important;
  background: none !important;
  color: var(--a-color-fg) !important;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.72rem;
  padding: 0.4rem 0.5rem !important;
}

.prose-blog-academic :deep(td) {
  border: none !important;
  border-bottom: 1px solid var(--a-color-border-soft) !important;
  padding: 0.4rem 0.5rem !important;
}

.prose-blog-academic :deep(tr):last-child :deep(td) {
  border-bottom: none !important;
}

.prose-blog-academic :deep(img) {
  break-inside: avoid;
  max-width: 100%;
  border: 1px solid var(--a-color-border-soft) !important;
}

.prose-blog-academic :deep(hr) {
  column-span: all;
  border: none;
  border-top: 1px solid var(--a-color-fg);
  margin: 2rem 0;
}

@media (max-width: 768px) {
  .prose-blog-academic {
    column-count: 1 !important;
    column-gap: 0;
  }
  .academic-abstract {
    max-width: 100%;
  }
}
</style>
