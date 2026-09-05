<template>
  <component
    :is="presentation === 'page' ? 'article' : PSheet"
    :show="show"
    :title="sheetTitle"
    close-type="bookmark"
    reading-mode
    :is-shifted="commentsBlockParent"
    :is-top-layer="!commentsBlockParent"
    :index="index"
    :ref="presentation === 'page' ? setPageContentAnchor : undefined"
    :class="{ 'feed-article-page': presentation === 'page' }"
    :navigation="presentation === 'sheet' ? articleNavigation : undefined"
    :navigation-key="presentation === 'sheet' ? articleKey : undefined"
    :navigation-direction="navigationDirection"
    @close="$emit('close')"
    @activate="closeComments"
    @navigate="navigateSheet"
  >
    <template v-if="article && article.type === 'post' && article.post">
      <div class="article-meta">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-trigger"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <a :href="userUrl(article.post.user?.username || '')" class="a-label a-muted" @click.stop>
          {{ article.post.user?.display_name || article.post.user?.username || '未知作者' }}
        </a>
        <span style="color:var(--a-color-muted-soft)">{{ formatDate(article.published_at) }}</span>
      </div>
      <h1 class="article-title">{{ article.post.title }}</h1>
      <div class="article-subtitle-meta">
        <PButton
          v-if="showSourceSubscribe && articleSource"
          data-test="feed-article-subscribe-source"
          :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
          :variant="articleSource.subscribed ? 'secondary' : 'primary'"
          :disabled="articleSource.subscribed"
          :loading="sourceSubscribeBusy"
          loading-text="订阅中..."
          @click="emit('subscribe-source')"
        />
        <PButton
          v-if="article.post.id"
          variant="secondary"
          size="sm"
          :disabled="!authStore.isAuthenticated"
          @click="togglePostBookmark"
        >
          <Bookmark :size="15" aria-hidden="true" />
          {{ postBookmarked ? '取消收藏' : '收藏' }}
        </PButton>
        <PButton
          v-if="article.post.id"
          variant="secondary"
          size="sm"
          :disabled="!authStore.isAuthenticated"
          @click="togglePostReadingList"
        >
          <Clock :size="15" aria-hidden="true" />
          {{ postInReadingList ? '取消稍后阅读' : '稍后阅读' }}
        </PButton>
      </div>
      
      <p v-if="article.post.summary" class="article-summary">{{ article.post.summary }}</p>
      <div class="prose-blog article-body" v-html="renderedContent"></div>
      <PostRatingControl
        :rating-score="article.post.rating_score"
        :rating-count="article.post.rating_count"
        :viewer-rating="article.post.viewer_rating"
        :disabled="!authStore.isAuthenticated"
        :loading="ratingLoading"
        :error-message="ratingError"
        @rate="ratePost"
        @clear="clearPostRating"
      />
    </template>
    
    <template v-else-if="article && article.type === 'feed_item' && article.feed_item">
      <div v-if="showFeedCover" class="article-cover" :class="{ 'article-cover--fallback': feedCoverFailed }">
        <img
          v-if="!feedCoverFailed"
          :src="feedCoverUrl"
          :alt="article.feed_item.title"
          @error="handleFeedCoverError"
        />
        <span v-else>{{ feedSourceTitle || 'RSS' }}</span>
      </div>
      <div class="article-meta article-meta--reader">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-trigger"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <span v-else class="a-label a-muted">{{ feedSourceTitle || 'RSS' }}</span>
        <span v-if="article.feed_item.author">{{ article.feed_item.author }}</span>
        <span>{{ formatDate(article.feed_item.published_at) }}</span>
        <span v-if="feedWordCountLabel">{{ feedWordCountLabel }}</span>
        <div class="article-source-actions">
          <PButton
            v-if="showSourceSubscribe && articleSource"
            data-test="feed-article-subscribe-source"
            :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
            :variant="articleSource.subscribed ? 'secondary' : 'primary'"
            :disabled="articleSource.subscribed"
            :loading="sourceSubscribeBusy"
            loading-text="订阅中..."
            @click="emit('subscribe-source')"
          />
          <button
            type="button"
            class="article-star-button"
            data-test="feed-article-quick-star"
            :aria-label="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :title="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :aria-pressed="feedItemStarred"
            :disabled="!authStore.isAuthenticated"
            @click="toggleFeedItemStar"
          >
            <Bookmark :size="16" aria-hidden="true" :fill="feedItemStarred ? 'currentColor' : 'none'" />
          </button>
        </div>
      </div>
      <h1 class="article-title">{{ article.feed_item.title }}</h1>
      <div class="article-toolbar">
        <a
          v-if="article.feed_item.link"
          :href="article.feed_item.link"
          target="_blank"
          rel="noopener noreferrer"
          class="article-source-link"
          aria-label="在源站查看"
          title="在源站查看"
        >
          <ExternalLink :size="16" aria-hidden="true" />
        </a>
        <button
          v-if="isPlayablePodcast"
          type="button"
          class="article-toolbar__button"
          data-test="feed-article-play"
          @click="emitPlayPodcast"
        >
          <Play :size="16" aria-hidden="true" />
          {{ isPodcastPlaying ? '播放中，暂停' : '播放播客' }}
        </button>
      </div>

      <div class="article-body-wrap">
        <div class="article-reader-controls">
          <PSegmentedControl
            v-if="showFeedContentModeSwitch"
            v-model="feedContentMode"
            class="article-content-switcher"
            aria-label="正文来源"
            :options="feedContentModeOptions"
          />
          <span v-else class="article-content-label">{{ feedContentStateLabel }}</span>
        </div>
        <BlogPostUpdateNotice
          class="article-content-validity"
          data-test="feed-article-validity-notice"
          :updated-at="article.feed_item.published_at"
        />
        <FeedReaderContent
          class="article-body article-body--external-feed"
          :html="feedBodyHtml"
          :base-url="article.feed_item.link"
        />
        <FeedContentFeedback :item-id="article.feed_item.id" :variant="feedContentVariant" />
        <footer class="article-reader-footer">
          <div class="article-reader-footer__actions">
            <PostRatingControl
              class="article-feed-rating"
              data-test="feed-article-rating"
              size="sm"
              :rating-score="article.feed_item.rating_score"
              :rating-count="article.feed_item.rating_count"
              :viewer-rating="article.feed_item.viewer_rating"
              :disabled="!authStore.isAuthenticated"
              :loading="ratingLoading"
              :error-message="ratingError"
              @rate="rateFeedItem"
              @clear="clearFeedItemRating"
            />
            <button
              type="button"
              class="article-reader-star"
              data-test="feed-article-footer-star"
              :aria-pressed="feedItemStarred"
              :disabled="!authStore.isAuthenticated"
              @click="toggleFeedItemStar"
            >
              <Bookmark :size="16" aria-hidden="true" :fill="feedItemStarred ? 'currentColor' : 'none'" />
              {{ feedItemStarred ? '取消收藏' : '收藏' }}
            </button>
          </div>
          <section v-if="relatedFeedItems.length" class="article-related-reading" data-test="feed-article-related-reading">
            <h2>推荐阅读</h2>
            <a
              v-for="item in relatedFeedItems"
              :key="item.id"
              :href="item.link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{{ item.title }}</span>
              <small>{{ formatDate(item.published_at) }}</small>
            </a>
          </section>
        </footer>
      </div>
    </template>
    <PDiscussionFAB
      v-if="article?.type === 'feed_item' && article.feed_item && show && presentation !== 'page'"
      :count="commentCount"
      @click="openComments"
    />
  </component>

  <button
    v-if="article?.type === 'feed_item' && article.feed_item && show && presentation === 'page'"
    type="button"
    class="article-comments-link"
    @click="openComments"
  >
    评论<span v-if="commentCount !== undefined"> · {{ commentCount }}</span>
  </button>
  <CommentSideSheet
    v-if="article?.type === 'feed_item' && article.feed_item"
    :show="commentsOpen"
    :title="commentSheetTitle"
    :partial-anchor="presentation === 'page' ? pageContentAnchor : null"
    :index="presentation === 'page' ? 0 : (index || 0) + 1"
    :target="{ kind: 'feed_article', resourceId: article.feed_item.id }"
    @close="closeComments"
    @activate="closeComments"
    @mode-change="commentSheetMode = $event"
    @count-change="commentCount = $event"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconBookmark as Bookmark, IconClock as Clock, IconExternalLink as ExternalLink, IconPlayerPlay as Play } from '@tabler/icons-vue'
import { apiRequestResult } from '@/api/client'
import type { FeedArticleSource, FeedItem, FeedItemReader, FeedReaderVariant, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import FeedContentFeedback from '@/components/feed/FeedContentFeedback.vue'
import FeedReaderContent from '@/components/feed/FeedReaderContent.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import { modulePathUrl, userUrl } from '@/composables/useSubdomainNav'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { hasFeedReaderImage } from '@/utils/feedReader'
import { resolveMediaURL } from '@/utils/mediaUrl'
import { isPlayableFeedPodcast } from '@/utils/feedPodcast'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'

const props = withDefaults(defineProps<{
  show: boolean
  article: TimelineItem | null
  reader?: FeedItemReader | null
  source?: FeedArticleSource | null
  showSourceSubscribe?: boolean
  sourceSubscribeBusy?: boolean
  isPodcastPlaying?: boolean
  index?: number
  hasPrevious?: boolean
  hasNext?: boolean
  relatedArticles?: TimelineItem[]
  presentation?: 'sheet' | 'page'
}>(), {
  reader: null,
  source: null,
  showSourceSubscribe: false,
  sourceSubscribeBusy: false,
  relatedArticles: () => [],
  presentation: 'sheet',
})

const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const authStore = useAuthStore()
const api = useApi()
const feedStore = useFeedStore()
const ratingLoading = ref(false)
const ratingError = ref('')
const feedCoverFailed = ref(false)
const feedCoverCandidateIndex = ref(0)
const commentsOpen = ref(false)
const commentSheetMode = ref<'full' | 'partial'>('partial')
const commentsBlockParent = computed(() => commentsOpen.value && commentSheetMode.value === 'full')
const commentCount = ref<number | undefined>(undefined)
const pageContentAnchor = ref<HTMLElement | null>(null)

const setPageContentAnchor = (element: unknown) => {
  pageContentAnchor.value = element instanceof HTMLElement ? element : null
}

const openComments = () => {
  commentSheetMode.value = 'partial'
  commentsOpen.value = true
}

const closeComments = () => {
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
}
type FeedContentMode = 'rss' | 'full_text'
const feedContentMode = ref<FeedContentMode>(defaultFeedContentMode(props.reader))
const feedContentModeOptions: Array<{ label: string; value: FeedContentMode; test: string }> = [
  { label: 'RSS', value: 'rss', test: 'feed-content-mode-rss' },
  { label: '全文', value: 'full_text', test: 'feed-content-mode-full-text' },
]

const postBookmarked = computed(() => {
  const post = props.article?.type === 'post' ? props.article.post : null
  return Boolean(post?.id && feedStore.bookmarkedPostIds.has(post.id))
})
const postInReadingList = computed(() => {
  const post = props.article?.type === 'post' ? props.article.post : null
  return Boolean(post?.id && feedStore.readingListItemIds.has(post.id))
})
const feedItemStarred = computed(() => {
  const item = props.article?.type === 'feed_item' ? props.article.feed_item : null
  return Boolean(item?.id && (item.is_starred || feedStore.starredItemIds.has(item.id)))
})
const relatedFeedItems = computed(() => {
  const currentItem = props.article?.type === 'feed_item' ? props.article.feed_item : null
  if (!currentItem) return []

  const seen = new Set([currentItem.id])
  return props.relatedArticles.flatMap((candidate) => {
    const item = candidate.type === 'feed_item' ? candidate.feed_item : undefined
    if (!item || item.feed_source_id !== currentItem.feed_source_id || seen.has(item.id)) return []
    seen.add(item.id)
    return [item]
  }).slice(0, 3)
})
const feedCoverCandidates = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return []
  const item = props.article.feed_item
  return [...new Set([
    item.image_url,
    item.feed_source?.cover_url,
  ].map((url) => url ? resolveMediaURL(url) : '').filter(Boolean))]
})

const feedCoverUrl = computed(() => feedCoverCandidates.value[feedCoverCandidateIndex.value] || '')

const handleFeedCoverError = () => {
  if (feedCoverCandidateIndex.value + 1 < feedCoverCandidates.value.length) {
    feedCoverCandidateIndex.value += 1
    return
  }
  feedCoverFailed.value = true
}


watch([() => props.article?.feed_item?.id, () => props.reader?.default_variant], () => {
  feedCoverFailed.value = false
  feedCoverCandidateIndex.value = 0
  commentsOpen.value = false
  commentSheetMode.value = 'partial'
  commentCount.value = undefined
  ratingError.value = ''
  feedContentMode.value = defaultFeedContentMode(props.reader)
})

const renderedContent = computed(() => {
  // Re-render after the lazily loaded KaTeX and code-highlight extensions are ready.
  void markdownRuntimeState.value
  if (props.article?.type === 'post' && props.article.post?.content) {
    return renderMarkdown(props.article.post.content)
  }
  return ''
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-source'): void
  (e: 'subscribe-source'): void
  (e: 'play-podcast', feedItem: FeedItem): void
  (e: 'previous'): void
  (e: 'next'): void
}>()

const sheetTitle = computed(() => {
  if (!props.article) return '文章-加载中'
  if (props.article.type === 'post' && props.article.post) {
    return `文章-${props.article.post.title || '未命名'}`
  }
  if (props.article.type === 'feed_item' && props.article.feed_item) {
    return `RSS文章-${props.article.feed_item.title || '未命名'}`
  }
  return '文章-加载中'
})

const commentSheetTitle = computed(() => {
  const title = props.article?.feed_item?.title || '未命名'
  return `Feed文章评论-${title}`
})

const articleKeyFor = (item: TimelineItem) => {
  if (item.type === 'post') return item.post?.id || ''
  return item.feed_item?.id || ''
}

const articleKey = computed(() => (
  props.article ? articleKeyFor(props.article) : ''
))

const articleLabel = (item: TimelineItem | undefined) => {
  if (!item) return ''
  if (item.type === 'post') return item.post?.title || '文章'
  return item.feed_item?.title || 'RSS 文章'
}

const articleNavigation = computed(() => {
  const index = props.article
    ? props.relatedArticles.findIndex((item) => articleKeyFor(item) === articleKey.value)
    : -1
  return {
    previous: props.hasPrevious
      ? { label: articleLabel(index > 0 ? props.relatedArticles[index - 1] : undefined) || '上一项' }
      : null,
    next: props.hasNext
      ? { label: articleLabel(index >= 0 ? props.relatedArticles[index + 1] : undefined) || '下一项' }
      : null,
  }
})

const navigationDirection = ref<'previous' | 'next'>('next')

const isPlayablePodcast = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return false
  return isPlayableFeedPodcast(props.article.feed_item)
})

const articleSource = computed<FeedArticleSource | null>(() => {
  if (props.source) return props.source
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return null

  const item = props.article.feed_item
  const sourceID = item.feed_source?.id || item.feed_source_id
  if (!sourceID) return null
  return {
    type: 'external_rss',
    id: sourceID,
    title: item.feed_source?.title || 'RSS',
    rssUrl: item.feed_source?.rss_url,
    subscribed: false,
  }
})

const feedSourceTitle = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  return articleSource.value?.title || ''
})

const rssBodyHtml = computed(() => props.reader?.rss?.html.trim() || '')

const fullTextBodyHtml = computed(() => {
  if (props.reader?.full_text.status !== 'success') return ''
  return props.reader.full_text.html?.trim() || ''
})

const hasReader = computed(() => Boolean(props.reader))
const hasRSSContent = computed(() => Boolean(rssBodyHtml.value))
const hasFullTextContent = computed(() => Boolean(fullTextBodyHtml.value))
const showFeedContentModeSwitch = computed(() => hasReader.value && hasRSSContent.value && hasFullTextContent.value)

function defaultFeedContentMode(reader?: FeedItemReader | null): FeedContentMode {
  if (reader?.default_variant === 'full_text' && reader.full_text.status === 'success' && reader.full_text.html?.trim()) {
    return 'full_text'
  }
  return 'rss'
}

const feedContentVariant = computed<FeedReaderVariant>(() => {
  if (hasReader.value) {
    if (feedContentMode.value === 'full_text' && hasFullTextContent.value) return 'full_text'
    if (hasRSSContent.value) return 'rss'
    if (hasFullTextContent.value) return 'full_text'
    return 'summary'
  }

  switch (props.article?.type === 'feed_item' ? props.article.feed_item?.content_source : undefined) {
    case 'feed':
      return 'rss'
    case 'page':
    case 'full_text':
      return 'full_text'
    default:
      return 'summary'
  }
})

const feedContentSource = feedContentVariant

const feedContentStateLabel = computed(() => {
  switch (feedContentVariant.value) {
    case 'full_text':
      return '全文'
    case 'rss':
      return 'RSS 正文'
    default:
      return 'RSS 摘要'
  }
})

const feedWordCountLabel = computed(() => {
  const html = feedBodyHtml.value
  const plainTextLength = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length
  const fullTextWordCount = props.reader?.full_text.word_count
    ?? (props.article?.type === 'feed_item' ? props.article.feed_item?.full_text_word_count : 0)
  const wordCount = feedContentVariant.value === 'full_text' ? fullTextWordCount : 0
  const count = wordCount || plainTextLength
  if (!count) return ''
  return `约 ${count.toLocaleString('zh-CN')} 字，${Math.max(1, Math.ceil(count / 400))} 分钟阅读`
})

const feedBodyHtml = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  if (hasReader.value) {
    if (feedContentVariant.value === 'full_text') return fullTextBodyHtml.value
    if (feedContentVariant.value === 'rss') return rssBodyHtml.value
    return props.article.feed_item.summary || ''
  }
  return props.article.feed_item.content_html || props.article.feed_item.content || props.article.feed_item.summary || ''
})

const showFeedCover = computed(() => Boolean(feedCoverUrl.value) && !hasFeedReaderImage(feedBodyHtml.value))

const { navigateWithShutter } = useAsyncNavigate()

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const handleReadMore = (post: Post) => {
  void navigateWithShutter(
    async () => Promise.resolve(post),
    modulePathUrl('blog', `/post/${post.id}`),
    'post'
  )
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show || !props.article || commentsOpen.value || event.defaultPrevented) return
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'ArrowLeft' && props.hasPrevious) {
    event.preventDefault()
    navigationDirection.value = 'previous'
    emit('previous')
  }
  if (event.key === 'ArrowRight' && props.hasNext) {
    event.preventDefault()
    navigationDirection.value = 'next'
    emit('next')
  }
}

const navigateSheet = (direction: 'previous' | 'next') => {
  navigationDirection.value = direction
  if (direction === 'previous') emit('previous')
  else emit('next')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

async function togglePostBookmark() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated) return
  await feedStore.togglePostBookmark(post.id)
}

async function togglePostReadingList() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated) return
  await feedStore.toggleReadingListItem(post.id)
}

async function toggleFeedItemStar() {
  const item = props.article?.type === 'feed_item' ? props.article.feed_item : null
  if (!item || !authStore.isAuthenticated) return
  await feedStore.toggleStar(item.id)
}

async function ratePost(score: number) {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) {
      ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.rating_score = Number(summary.rating_score ?? post.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? post.rating_count ?? 0)
    post.viewer_rating = Number(summary.viewer_rating ?? score)
  } catch {
    ratingError.value = '评分未保存，请重试'
  } finally {
    ratingLoading.value = false
  }
}

async function clearPostRating() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) {
      ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.rating_score = Number(summary.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? 0)
    post.viewer_rating = undefined
  } catch {
    ratingError.value = '评分未清除，请重试'
  } finally {
    ratingLoading.value = false
  }
}

function applyFeedItemRating(summary: Record<string, unknown>, fallbackScore?: number) {
  const item = props.article?.type === 'feed_item' ? props.article.feed_item : null
  if (!item) return
  item.rating_score = Number(summary.rating_score ?? item.rating_score ?? 0)
  item.rating_count = Number(summary.rating_count ?? item.rating_count ?? 0)
  item.viewer_rating = summary.viewer_rating === null || summary.viewer_rating === undefined
    ? fallbackScore
    : Number(summary.viewer_rating)
}

async function rateFeedItem(score: number) {
  const item = props.article?.type === 'feed_item' ? props.article.feed_item : null
  if (!item || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.feed.itemRating(item.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!response.ok) {
      ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(response.data)
    applyFeedItemRating(payload.data || payload, score)
  } catch {
    ratingError.value = '评分未保存，请重试'
  } finally {
    ratingLoading.value = false
  }
}

async function clearFeedItemRating() {
  const item = props.article?.type === 'feed_item' ? props.article.feed_item : null
  if (!item || !authStore.isAuthenticated || ratingLoading.value) return
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.feed.itemRating(item.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!response.ok) {
      ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(response.data)
    applyFeedItemRating(payload.data || payload)
    item.viewer_rating = undefined
  } catch {
    ratingError.value = '评分未清除，请重试'
  } finally {
    ratingLoading.value = false
  }
}

const emitPlayPodcast = () => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return
  emit('play-podcast', props.article.feed_item)
}
</script>

<style scoped>
.feed-article-page {
  display: block;
  min-width: 0;
  padding: 1rem 0 2rem;
}

.article-comments-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin: 0.5rem 0 1rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-primary);
  font: inherit;
  cursor: pointer;
}

.article-cover {
  width: 100%;
  height: 280px;
  margin-bottom: 3rem;
  border: 1px solid var(--a-color-border-soft);
  filter: grayscale(100%);
  overflow: hidden;
}

.article-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.article-cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--a-color-text-secondary);
  background: var(--a-color-surface-muted);
  font-size: 1.1rem;
  font-weight: 600;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.8rem;
  align-items: center;
  margin-bottom: 1.15rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  line-height: 1.5;
}

.article-source-trigger {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.article-source-trigger:hover {
  color: var(--a-color-text);
  text-decoration: underline;
}

.article-source-trigger:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.article-source-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.article-star-button,
.article-source-link,
.article-toolbar__button {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  text-decoration: none;
}

.article-star-button {
  padding: 0.4rem;
}

.article-star-button[aria-pressed='true'] {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.article-star-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.article-title {
  max-width: 26ch;
  margin: 0 0 1.35rem;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 2rem;
  font-weight: 650;
  line-height: 1.22;
  letter-spacing: 0;
  text-wrap: balance;
}

.article-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 2rem;
}

.article-source-link,
.article-toolbar__button {
  padding: 0.4rem 0.7rem;
}

.article-source-link {
  width: 44px;
  padding: 0.4rem;
}

.article-source-link:hover,
.article-toolbar__button:hover,
.article-star-button:hover {
  border-color: var(--a-color-text);
}

.article-source-link:focus-visible,
.article-toolbar__button:focus-visible,
.article-star-button:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.article-summary {
  font-size: 1.25rem;
  color: var(--a-color-muted);
  line-height: 1.8;
  font-style: italic;
  margin-bottom: 3rem;
  padding-left: 1.5rem;
  border-left: 3px solid var(--a-color-fg);
}

.article-body:not(.feed-reader-content) {
  margin-bottom: 4rem;
  max-width: 100%;
  min-width: 0;
}

.feed-reader-content.article-body {
  margin-bottom: 4rem;
}

.article-body-wrap {
  display: grid;
  gap: 1rem;
  max-width: 100%;
  min-width: 0;
}

.article-reader-controls {
  display: flex;
  min-height: 36px;
  align-items: center;
}

.article-content-switcher {
  width: fit-content;
}

.article-content-label {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 600;
}

.article-content-validity {
  margin: 0;
}

.article-reader-footer {
  display: grid;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.article-reader-footer__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.article-feed-rating {
  flex: 1 1 100%;
  min-width: 0;
}

.article-reader-star {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 600;
}

.article-reader-star[aria-pressed='true'] {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.article-reader-star:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.article-related-reading h2 {
  margin: 0 0 0.5rem;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 0.95rem;
}

.article-related-reading a {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 0.85rem;
  text-decoration: none;
}

.article-related-reading a:hover {
  color: var(--a-color-primary);
}

.article-related-reading small {
  flex: 0 0 auto;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

@media (max-width: 767px) {
  .article-cover {
    height: 220px;
    margin-bottom: 2rem;
  }

  .article-title {
    font-size: 1.7rem;
  }

  .article-toolbar {
    margin-bottom: 1.5rem;
  }

  .article-related-reading a {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.45rem 0;
  }
}
</style>
