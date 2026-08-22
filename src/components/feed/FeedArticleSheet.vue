<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    width="min(100%, 800px)"
    close-type="bookmark"
    reading-mode
    :is-shifted="commentsOpen"
    :is-top-layer="!commentsOpen"
    :index="index"
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
          @error="feedCoverFailed = true"
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
        <FeedContentFeedback :item-id="article.feed_item.id" />
      </div>
    </template>
  </PSheet>

  <PDiscussionFAB
    v-if="article?.type === 'feed_item' && article.feed_item && show"
    :count="commentCount"
    @click="commentsOpen = true"
  />
  <PSheet
    v-if="article?.type === 'feed_item' && article.feed_item"
    :show="commentsOpen"
    title="评论"
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
import type { FeedArticleSource, FeedItem, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
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
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'

const props = withDefaults(defineProps<{
  show: boolean
  article: TimelineItem | null
  source?: FeedArticleSource | null
  showSourceSubscribe?: boolean
  sourceSubscribeBusy?: boolean
  isPodcastPlaying?: boolean
  index?: number
  hasPrevious?: boolean
  hasNext?: boolean
}>(), {
  source: null,
  showSourceSubscribe: false,
  sourceSubscribeBusy: false,
})

const { renderMarkdown } = useMarkdownRenderer()
const authStore = useAuthStore()
const api = useApi()
const feedStore = useFeedStore()
const ratingLoading = ref(false)
const feedCoverFailed = ref(false)
const commentsOpen = ref(false)
const commentCount = ref<number | undefined>(undefined)

const postBookmarked = computed(() => {
  const post = props.article?.type === 'post' ? props.article.post : null
  return Boolean(post?.id && feedStore.bookmarkedPostIds.has(post.id))
})
const postInReadingList = computed(() => {
  const post = props.article?.type === 'post' ? props.article.post : null
  return Boolean(post?.id && feedStore.readingListItemIds.has(post.id))
})
const feedCoverUrl = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  const rawURL = props.article.feed_item.image_url || props.article.feed_item.feed_source?.cover_url || ''
  return rawURL ? resolveMediaURL(rawURL) : ''
})


watch(() => props.article?.feed_item?.id, () => {
  feedCoverFailed.value = false
  commentsOpen.value = false
  commentCount.value = undefined
})

const renderedContent = computed(() => {
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
  if (!props.article) return '文章'
  if (props.article.type === 'post' && props.article.post) {
    return props.article.post.title
  }
  if (props.article.type === 'feed_item' && props.article.feed_item) {
    return props.article.feed_item.title
  }
  return '文章'
})

const isPlayablePodcast = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return false
  return Boolean(props.article.feed_item.enclosure_url)
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

const feedContentSource = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return 'summary'
  if (props.article.feed_item.content_source) return props.article.feed_item.content_source
  if (props.article.feed_item.full_text_status === 'success') return 'page'
  return 'summary'
})

const feedContentStateLabel = computed(() => {
  switch (feedContentSource.value) {
    case 'page':
    case 'full_text':
      return '网页正文'
    case 'feed':
      return '订阅正文'
    default:
      return '摘要'
  }
})

const feedWordCountLabel = computed(() => {
  const html = feedBodyHtml.value
  const plainTextLength = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length
  const wordCount = props.article?.type === 'feed_item' ? props.article.feed_item?.full_text_word_count : 0
  const count = wordCount || plainTextLength
  if (!count) return ''
  return `约 ${count.toLocaleString('zh-CN')} 字，${Math.max(1, Math.ceil(count / 400))} 分钟阅读`
})

const feedBodyHtml = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  return (
    props.article.feed_item.content_html
    || props.article.feed_item.full_text_html
    || props.article.feed_item.content
    || props.article.feed_item.summary
    || ''
  )
})

const showFeedCover = computed(() => Boolean(feedCoverUrl.value) && !hasFeedReaderImage(feedBodyHtml.value))

const feedContentStateDescription = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  if (feedContentSource.value === 'page' || feedContentSource.value === 'full_text') {
    return '已展示网页正文'
  }
  if (feedContentSource.value === 'feed') {
    return '已展示订阅源提供的正文'
  }
  return props.article.feed_item.summary ? '当前仅展示摘要' : ''
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
