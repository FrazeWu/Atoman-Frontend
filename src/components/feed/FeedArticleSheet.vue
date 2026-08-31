<template>
  <component
    :is="presentation === 'page' ? 'article' : PSheet"
    :show="show"
    :title="sheetTitle"
    width="min(100%, 800px)"
    close-type="bookmark"
    reading-mode
    :is-shifted="commentsOpen"
    :is-top-layer="!commentsOpen"
    :index="index"
    :class="{ 'feed-article-page': presentation === 'page' }"
    @close="$emit('close')"
    @activate="commentsOpen = false"
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
        <span v-else class="a-label a-muted">{{ feedSourceTitle || 'RSS' }}</span>
        <span v-if="article.feed_item.author">{{ article.feed_item.author }}</span>
        <span>{{ formatDate(article.feed_item.published_at) }}</span>
        <span v-if="feedWordCountLabel">{{ feedWordCountLabel }}</span>
      </div>
      <h1 class="article-title">{{ article.feed_item.title }}</h1>
      <div class="article-toolbar">
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
        <a
          v-if="article.feed_item.link"
          :href="article.feed_item.link"
          target="_blank"
          rel="noopener noreferrer"
          class="article-source-link"
        >
          <ExternalLink :size="16" aria-hidden="true" />
          在源站查看
        </a>
        <button
          v-if="isPlayablePodcast"
          type="button"
          class="article-toolbar__button"
          data-test="feed-article-play"
          @click="emitPlayPodcast"
        >
          {{ isPodcastPlaying ? '播放中，暂停' : '播放播客' }}
        </button>
      </div>
      
      <div class="article-body-wrap">
        <PSegmentedControl
          v-if="showFeedContentModeSwitch"
          v-model="feedContentMode"
          class="article-content-switcher"
          aria-label="正文来源"
          :options="feedContentModeOptions"
        />
        <PBadge v-if="feedContentStateLabel" :type="feedContentSource === 'summary' ? 'external' : 'internal'">
          {{ feedContentStateLabel }}
        </PBadge>
        <p v-if="feedContentStateDescription" class="article-content-note">
          {{ feedContentStateDescription }}
        </p>
        <FeedReaderContent
          class="article-body article-body--external-feed"
          :html="feedBodyHtml"
          :base-url="article.feed_item.link"
        />
        <FeedContentFeedback :item-id="article.feed_item.id" :variant="feedContentVariant" />
      </div>
    </template>
    <PDiscussionFAB
      v-if="article?.type === 'feed_item' && article.feed_item && show && presentation !== 'page'"
      :count="commentCount"
      @click="commentsOpen = true"
    />
  </component>

  <button
    v-if="article?.type === 'feed_item' && article.feed_item && show && presentation === 'page'"
    type="button"
    class="article-comments-link"
    @click="commentsOpen = true"
  >
    评论<span v-if="commentCount !== undefined"> · {{ commentCount }}</span>
  </button>
  <section
    v-if="article?.type === 'feed_item' && article.feed_item && presentation === 'page' && commentsOpen"
    class="article-comments-section"
  >
    <CommentSection
      :target="{ kind: 'feed_article', resourceId: article.feed_item.id }"
      @count-change="commentCount = $event"
    />
  </section>
  <PSheet
    v-else-if="article?.type === 'feed_item' && article.feed_item"
    :show="commentsOpen"
    :title="commentSheetTitle"
    width="min(100%, 48rem)"
    content-max-width="42rem"
    :index="(index || 0) + 1"
    @close="commentsOpen = false"
    @activate="commentsOpen = false"
  >
    <CommentSection
      :target="{ kind: 'feed_article', resourceId: article.feed_item.id }"
      @count-change="commentCount = $event"
    />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bookmark, Clock, ExternalLink } from 'lucide-vue-next'
import { apiRequestResult } from '@/api/client'
import type { FeedArticleSource, FeedItem, FeedItemReader, FeedReaderVariant, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import FeedContentFeedback from '@/components/feed/FeedContentFeedback.vue'
import FeedReaderContent from '@/components/feed/FeedReaderContent.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
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
  presentation?: 'sheet' | 'page'
}>(), {
  reader: null,
  source: null,
  showSourceSubscribe: false,
  sourceSubscribeBusy: false,
  presentation: 'sheet',
})

const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const authStore = useAuthStore()
const api = useApi()
const feedStore = useFeedStore()
const ratingLoading = ref(false)
const feedCoverFailed = ref(false)
const feedCoverCandidateIndex = ref(0)
const commentsOpen = ref(false)
const commentCount = ref<number | undefined>(undefined)
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
  commentCount.value = undefined
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
      return '摘要'
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

const feedContentStateDescription = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  if (feedContentVariant.value === 'full_text') return '已展示抓取的全文'
  if (feedContentVariant.value === 'rss') return '已展示 RSS 正文'
  return props.article.feed_item.summary ? '当前仅展示 RSS 摘要' : ''
})

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
    emit('previous')
  }
  if (event.key === 'ArrowRight' && props.hasNext) {
    event.preventDefault()
    emit('next')
  }
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

async function ratePost(score: number) {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated || ratingLoading.value) return
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) return
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.rating_score = Number(summary.rating_score ?? post.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? post.rating_count ?? 0)
    post.viewer_rating = Number(summary.viewer_rating ?? score)
  } finally {
    ratingLoading.value = false
  }
}

async function clearPostRating() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !authStore.isAuthenticated || ratingLoading.value) return
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) return
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.rating_score = Number(summary.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? 0)
    post.viewer_rating = undefined
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

.article-comments-section {
  margin: 1rem 0 2rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
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
  margin-bottom: 2.5rem;
}

.article-source-link,
.article-toolbar__button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 0.42rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  text-decoration: none;
}

.article-source-link:hover,
.article-toolbar__button:hover {
  border-color: var(--a-color-text);
}

.article-source-link:focus-visible,
.article-toolbar__button:focus-visible {
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

.article-content-switcher {
  width: fit-content;
}

.article-content-note {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  line-height: 1.6;
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
    margin-bottom: 2rem;
  }
}
</style>
