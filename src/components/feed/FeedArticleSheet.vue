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
      <div class="article-eyebrow">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-badge"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <span v-if="source && articleSource" class="article-eyebrow__sep" aria-hidden="true">·</span>
        <a :href="userUrl(article.post.user?.username || '')" class="article-author-link" @click.stop>
          {{ article.post.user?.display_name || article.post.user?.username || '未知作者' }}
        </a>
        <span class="article-eyebrow__sep" aria-hidden="true">·</span>
        <span class="article-eyebrow__date">{{ formatDate(article.published_at || article.post.created_at) }}</span>
      </div>
      <h1 class="article-title article-headline">{{ article.post.title }}</h1>
      <div class="article-action-strip">
        <div class="article-action-strip__left">
          <PButton
            v-if="showSourceSubscribe && articleSource"
            data-test="feed-article-subscribe-source"
            :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
            :variant="articleSource.subscribed ? 'secondary' : 'primary'"
            :disabled="articleSource.subscribed"
            :loading="sourceSubscribeBusy"
            size="sm"
            loading-text="订阅中..."
            @click="emit('subscribe-source')"
          />
        </div>
        <div class="article-action-strip__right">
          <button
            v-if="article.post.id"
            type="button"
            class="article-action-btn"
            data-test="feed-article-post-bookmark"
            :aria-label="postBookmarked ? '取消收藏文章' : '收藏文章'"
            :title="postBookmarked ? '取消收藏文章' : '收藏文章'"
            :aria-pressed="postBookmarked"
            @click="togglePostBookmark"
          >
            <Check v-if="postBookmarked" :size="15" aria-hidden="true" />
            <Bookmark v-else :size="15" aria-hidden="true" />
            <span>{{ postBookmarked ? '已收藏' : '收藏' }}</span>
          </button>
          <button
            v-if="article.post.id"
            type="button"
            class="article-action-btn"
            data-test="feed-article-post-readlater"
            :aria-label="postInReadingList ? '取消稍后阅读' : '稍后阅读'"
            :title="postInReadingList ? '取消稍后阅读' : '稍后阅读'"
            :aria-pressed="postInReadingList"
            @click="togglePostReadingList"
          >
            <Clock :size="15" aria-hidden="true" />
            <span>{{ postInReadingList ? '已稍后读' : '稍后读' }}</span>
          </button>
        </div>
      </div>
      
      <p v-if="article.post.summary" class="article-summary">{{ article.post.summary }}</p>
      <div class="prose-blog article-body" v-html="renderedContent" @click="handleArticleBodyClick"></div>
      <PostRatingControl
        :rating-score="article.post.rating_score"
        :rating-count="article.post.rating_count"
        :viewer-rating="article.post.viewer_rating"
        :loading="ratingLoading"
        :error-message="ratingError"
        @rate="ratePost"
        @clear="clearPostRating"
      />
    </template>
    
    <template v-else-if="article && isFeedItemTimeline(article) && article.feed_item">
      <div class="article-eyebrow">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-badge"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <span v-else class="article-source-badge article-source-badge--static">{{ feedSourceTitle || 'RSS' }}</span>
        <template v-if="article.feed_item.author">
          <span class="article-eyebrow__sep" aria-hidden="true">·</span>
          <span class="article-author-name">{{ article.feed_item.author }}</span>
        </template>
        <span class="article-eyebrow__sep" aria-hidden="true">·</span>
        <span class="article-eyebrow__date">{{ formatDate(article.feed_item.published_at || article.feed_item.fetched_at) }}</span>
        <template v-if="feedWordCountLabel">
          <span class="article-eyebrow__sep" aria-hidden="true">·</span>
          <span class="article-eyebrow__reading-time">{{ feedWordCountLabel }}</span>
        </template>
      </div>
      <h1 class="article-title article-headline">{{ article.feed_item.title }}</h1>
      <div class="article-action-strip">
        <div class="article-action-strip__left">
          <PButton
            v-if="showSourceSubscribe && articleSource"
            data-test="feed-article-subscribe-source"
            :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
            :variant="articleSource.subscribed ? 'secondary' : 'primary'"
            :disabled="articleSource.subscribed"
            :loading="sourceSubscribeBusy"
            size="sm"
            loading-text="订阅中..."
            @click="emit('subscribe-source')"
          />
          <PLink
            v-if="article.feed_item.link"
            :href="article.feed_item.link"
            class="article-source-link"
            aria-label="在源站查看"
            title="在源站查看"
            label="前往源站"
          />
          <button
            v-if="isPlayablePodcast"
            type="button"
            class="article-play-button"
            data-test="feed-article-play"
            @click="emitPlayPodcast"
          >
            <Play :size="15" aria-hidden="true" />
            <span>{{ isPodcastPlaying ? '播放中' : '播放播客' }}</span>
          </button>
        </div>
        <div class="article-action-strip__right">
          <PSegmentedControl
            v-if="showFeedContentModeSwitch"
            v-model="feedContentMode"
            class="article-content-switcher"
            aria-label="正文来源"
            :options="feedContentModeOptions"
          />
          <span v-else class="article-content-label">{{ feedContentStateLabel }}</span>
          <button
            type="button"
            class="article-action-btn"
            data-test="feed-article-quick-star"
            :aria-label="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :title="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :aria-pressed="feedItemStarred"
            @click="toggleFeedItemStar"
          >
            <Check v-if="feedItemStarred" :size="15" aria-hidden="true" />
            <Bookmark v-else :size="15" aria-hidden="true" />
            <span>{{ feedItemStarred ? '已收藏' : '收藏' }}</span>
          </button>
          <button
            type="button"
            class="article-action-btn article-action-btn--comments"
            data-test="feed-article-comments-trigger"
            :aria-label="commentCount ? `评论 (${commentCount})` : '评论'"
            @click="openComments"
          >
            <MessageSquare :size="15" aria-hidden="true" />
            <span>评论</span>
            <span v-if="commentCount !== undefined && commentCount > 0" class="article-action-count">{{ commentCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="showFeedCover" class="article-cover" :class="{ 'article-cover--fallback': feedCoverFailed }">
        <img
          v-if="!feedCoverFailed"
          :src="feedCoverUrl"
          :alt="article.feed_item.title"
          @error="handleFeedCoverError"
        />
        <span v-else>{{ feedSourceTitle || 'RSS' }}</span>
      </div>

      <div class="article-body-wrap">
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
              :title="feedItemStarred ? '取消收藏' : '收藏'"
              @click="toggleFeedItemStar"
            >
              <Check v-if="feedItemStarred" :size="16" aria-hidden="true" />
              <Bookmark v-else :size="16" aria-hidden="true" />
              {{ feedItemStarred ? '已收藏' : '收藏' }}
            </button>
          </div>
          <section v-if="relatedFeedItems.length" class="article-related-reading" data-test="feed-article-related-reading" @click="handleSafeLinkClick">
            <h2>推荐阅读</h2>
            <a
              v-for="item in relatedFeedItems"
              :key="item.id"
              :href="safeExternalUrl(item.link)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{{ item.title }} <span aria-hidden="true">↗</span></span>
              <small>{{ formatDate(item.published_at) }}</small>
            </a>
          </section>
        </footer>
      </div>
    </template>
    <nav v-if="presentation === 'page'" class="feed-article-page__navigation" aria-label="文章导航">
      <PButton variant="secondary" @click="emit('close')">返回列表</PButton>
      <PButton v-if="hasPrevious" variant="ghost" @click="emit('previous')">上一篇</PButton>
      <PButton v-if="hasNext" variant="ghost" @click="emit('next')">下一篇</PButton>
    </nav>
    <PDiscussionFAB
    v-if="article && isFeedItemTimeline(article) && article.feed_item && show && presentation !== 'page' && !commentsOpen"
      :count="commentCount"
      @click="openComments"
    />
  </component>

  <button
    v-if="article && isFeedItemTimeline(article) && article.feed_item && show && presentation === 'page'"
    type="button"
    class="article-comments-link"
    @click="openComments"
  >
    评论<span v-if="commentCount !== undefined"> · {{ commentCount }}</span>
  </button>
  <CommentSideSheet
    v-if="article && isFeedItemTimeline(article) && article.feed_item"
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
import '@/assets/editor.css'
import '@/assets/feed-reader.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bookmark, Check, Clock, MessageSquare, Play } from 'lucide-vue-next'
import { apiRequestResult } from '@/api/client'
import type { FeedArticleSource, FeedItem, FeedItemReader, FeedReaderVariant, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PLink from '@/components/ui/PLink.vue'
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
import { safeExternalUrl } from '@/utils/safeExternalUrl'
import { useRouter } from 'vue-router'
import { useSafeLink } from '@/composables/useSafeLink'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { useBlogMediaEmbeds } from '@/composables/useBlogMediaEmbeds'

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

const isFeedItemTimeline = (
	item: TimelineItem | null | undefined,
): item is TimelineItem & { type: 'feed_item' | 'project_update'; feed_item: FeedItem } =>
	(item?.type === 'feed_item' || item?.type === 'project_update') && Boolean(item.feed_item)

const router = useRouter()
const { renderMarkdown, runtimeState: markdownRuntimeState } = useMarkdownRenderer()
const { postEmbeds, musicEmbeds, videoEmbeds, load: loadMediaEmbeds } = useBlogMediaEmbeds()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
const api = useApi()
const feedStore = useFeedStore()
const { handleSafeLinkClick } = useSafeLink()
const ratingLoading = ref(false)
let ratingRequestSequence = 0
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
  const item = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  return Boolean(item?.id && (item.is_starred || feedStore.starredItemIds.has(item.id)))
})
const relatedFeedItems = computed(() => {
  const currentItem = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  if (!currentItem) return []

  const seen = new Set([currentItem.id])
  return props.relatedArticles.flatMap((candidate) => {
    const item = isFeedItemTimeline(candidate) ? candidate.feed_item : undefined
    if (!item || item.feed_source_id !== currentItem.feed_source_id || seen.has(item.id)) return []
    seen.add(item.id)
    return [item]
  }).slice(0, 3)
})
const feedCoverCandidates = computed(() => {
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return []
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

watch(
  () => (props.article?.type === 'post' ? props.article.post?.content : undefined),
  (content) => {
    if (content) {
      void loadMediaEmbeds(content, authStore.token || undefined)
    }
  },
  { immediate: true },
)

const renderedContent = computed(() => {
  // Re-render after the lazily loaded KaTeX and code-highlight extensions are ready.
  void markdownRuntimeState.value
  if (props.article?.type === 'post' && props.article.post?.content) {
    return renderMarkdown(props.article.post.content, {
      postEmbeds: postEmbeds.value,
      musicEmbeds: musicEmbeds.value,
      videoEmbeds: videoEmbeds.value,
      interactiveMedia: true,
    })
  }
  return ''
})

function handleArticleBodyClick(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element) {
    const button = target.closest<HTMLButtonElement>('[data-atoman-embed-play="music"]')
    if (button) {
      const id = button.dataset.atomanEmbedId
      const embed = id ? musicEmbeds.value[id] : undefined
      const songs = embed?.playbackSongs || []
      if (embed && songs.length) {
        event.preventDefault()
        event.stopPropagation()
        const player = usePlayerStore()
        if (embed.kind === 'song') player.playSong(songs[0])
        else player.playAlbum(songs)
        player.expandPlayer?.()
        return
      }
    }

    const embedLink = target.closest<HTMLAnchorElement>('a[data-atoman-embed]')
    const href = embedLink?.getAttribute('href')
    if (embedLink && href && !href.startsWith('#')) {
      event.preventDefault()
      event.stopPropagation()
      void router.push(href)
      return
    }
  }

  handleSafeLinkClick(event)
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-source'): void
  (e: 'subscribe-source'): void
  (e: 'play-podcast', feedItem: FeedItem): void
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'require-auth', payload: { articleId: string; action: 'star' | 'read_later' }): void
}>()

const sheetTitle = computed(() => {
  if (!props.article) return '文章-加载中'
  if (props.article.type === 'post' && props.article.post) {
    return `文章-${props.article.post.title || '未命名'}`
  }
  if (isFeedItemTimeline(props.article) && props.article.feed_item) {
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
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return false
  return isPlayableFeedPodcast(props.article.feed_item)
})

const articleSource = computed<FeedArticleSource | null>(() => {
  if (props.source) return props.source
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return null

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
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return ''
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

  switch (isFeedItemTimeline(props.article) ? props.article.feed_item?.content_source : undefined) {
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
    ?? (isFeedItemTimeline(props.article) ? props.article.feed_item?.full_text_word_count : 0)
  const wordCount = feedContentVariant.value === 'full_text' ? fullTextWordCount : 0
  const count = wordCount || plainTextLength
  if (!count) return ''
  return `约 ${count.toLocaleString('zh-CN')} 字，${Math.max(1, Math.ceil(count / 400))} 分钟阅读`
})

const feedBodyHtml = computed(() => {
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return ''
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
  if (!post) return
  if (!authStore.isAuthenticated) {
    emit('require-auth', { articleId: post.id, action: 'star' })
    return
  }
  await feedStore.togglePostBookmark(post.id)
}

async function togglePostReadingList() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post) return
  if (!authStore.isAuthenticated) {
    emit('require-auth', { articleId: post.id, action: 'read_later' })
    return
  }
  await feedStore.toggleReadingListItem(post.id)
}

async function toggleFeedItemStar() {
  const item = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  if (!item) return
  if (!authStore.isAuthenticated) {
    emit('require-auth', { articleId: item.id, action: 'star' })
    return
  }
  await feedStore.toggleStar(item.id)
}

async function ratePost(score: number) {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !requireLogin() || ratingLoading.value) return
  const requestSequence = ++ratingRequestSequence
  const requestedKey = articleKey.value
  const isCurrent = () => requestSequence === ratingRequestSequence && articleKey.value === requestedKey
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) {
      if (isCurrent()) ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    if (!isCurrent()) return
    post.rating_score = Number(summary.rating_score ?? post.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? post.rating_count ?? 0)
    post.viewer_rating = Number(summary.viewer_rating ?? score)
  } catch {
    if (isCurrent()) ratingError.value = '评分未保存，请重试'
  } finally {
    if (isCurrent()) ratingLoading.value = false
  }
}

async function clearPostRating() {
  const post = props.article?.type === 'post' ? props.article.post : null
  if (!post || !requireLogin() || ratingLoading.value) return
  const requestSequence = ++ratingRequestSequence
  const requestedKey = articleKey.value
  const isCurrent = () => requestSequence === ratingRequestSequence && articleKey.value === requestedKey
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) {
      if (isCurrent()) ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    if (!isCurrent()) return
    post.rating_score = Number(summary.rating_score ?? 0)
    post.rating_count = Number(summary.rating_count ?? 0)
    post.viewer_rating = undefined
  } catch {
    if (isCurrent()) ratingError.value = '评分未清除，请重试'
  } finally {
    if (isCurrent()) ratingLoading.value = false
  }
}

function applyFeedItemRating(summary: Record<string, unknown>, fallbackScore?: number) {
  const item = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  if (!item) return
  item.rating_score = Number(summary.rating_score ?? item.rating_score ?? 0)
  item.rating_count = Number(summary.rating_count ?? item.rating_count ?? 0)
  item.viewer_rating = summary.viewer_rating === null || summary.viewer_rating === undefined
    ? fallbackScore
    : Number(summary.viewer_rating)
}

async function rateFeedItem(score: number) {
  const item = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  if (!item || !requireLogin() || ratingLoading.value) return
  const requestSequence = ++ratingRequestSequence
  const requestedKey = articleKey.value
  const isCurrent = () => requestSequence === ratingRequestSequence && articleKey.value === requestedKey
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.feed.itemRating(item.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!response.ok) {
      if (isCurrent()) ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(response.data)
    if (isCurrent()) applyFeedItemRating(payload.data || payload, score)
  } catch {
    if (isCurrent()) ratingError.value = '评分未保存，请重试'
  } finally {
    if (isCurrent()) ratingLoading.value = false
  }
}

async function clearFeedItemRating() {
  const item = isFeedItemTimeline(props.article) ? props.article.feed_item : null
  if (!item || !requireLogin() || ratingLoading.value) return
  const requestSequence = ++ratingRequestSequence
  const requestedKey = articleKey.value
  const isCurrent = () => requestSequence === ratingRequestSequence && articleKey.value === requestedKey
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const response = await apiRequestResult(api.feed.itemRating(item.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!response.ok) {
      if (isCurrent()) ratingError.value = '评分未清除，请重试'
      return
    }
    const payload = await Promise.resolve(response.data)
    if (!isCurrent()) return
    applyFeedItemRating(payload.data || payload)
    item.viewer_rating = undefined
  } catch {
    if (isCurrent()) ratingError.value = '评分未清除，请重试'
  } finally {
    if (isCurrent()) ratingLoading.value = false
  }
}

const emitPlayPodcast = () => {
  if (!isFeedItemTimeline(props.article) || !props.article.feed_item) return
  emit('play-podcast', props.article.feed_item)
}
</script>

<style scoped>
@import "./feedArticleSheet.css";
</style>
