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
        <a :href="userUrl(article.post.user?.username || '')" class="a-label a-muted" @click.stop>
          {{ article.post.user?.display_name || article.post.user?.username || '未知作者' }}
        </a>
        <span style="color:var(--a-color-muted-soft)">{{ formatDate(article.published_at) }}</span>
      </div>
      <h1 class="article-title">{{ article.post.title }}</h1>
      <div class="article-subtitle-meta">
        <a :href="modulePathUrl('blog', `/post/${article.post.id}`)" class="read-original-link" @click.prevent="handleReadMore(article.post); $emit('close')">
          ↗ 阅读原文
        </a>
        <button
          v-if="hasPrevious"
          type="button"
          class="read-original-link article-nav-link"
          data-test="feed-article-prev"
          @click="emit('previous')"
        >
          ← 上一篇
        </button>
        <button
          v-if="hasNext"
          type="button"
          class="read-original-link article-nav-link"
          data-test="feed-article-next"
          @click="emit('next')"
        >
          下一篇 →
        </button>
      </div>
      
      <p v-if="article.post.summary" class="article-summary">{{ article.post.summary }}</p>
      <div class="prose-blog article-body" v-html="renderedContent"></div>
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
        <span class="a-label a-muted">{{ article.feed_item.feed_source?.title || 'RSS' }}</span>
        <span v-if="article.feed_item.author">{{ article.feed_item.author }}</span>
        <span>{{ formatDate(article.feed_item.published_at) }}</span>
        <span v-if="feedWordCountLabel">{{ feedWordCountLabel }}</span>
      </div>
      <h1 class="article-title">{{ article.feed_item.title }}</h1>
      <div class="article-toolbar">
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
  <div v-if="show" class="article-navigation" aria-label="文章导航">
    <button type="button" :disabled="!hasPrevious" aria-label="上一篇" title="上一篇" data-test="feed-article-prev" @click="emit('previous')">
      <ChevronLeft :size="20" aria-hidden="true" />
    </button>
    <button type="button" :disabled="!hasNext" aria-label="下一篇" title="下一篇" data-test="feed-article-next" @click="emit('next')">
      <ChevronRight :size="20" aria-hidden="true" />
    </button>
  </div>
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
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-vue-next'
import type { FeedItem, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import FeedContentFeedback from '@/components/feed/FeedContentFeedback.vue'
import FeedReaderContent from '@/components/feed/FeedReaderContent.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import { modulePathUrl, userUrl } from '@/composables/useSubdomainNav'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { resolveMediaURL } from '@/utils/mediaUrl'
import { hasFeedReaderImage } from '@/utils/feedReader'

const props = defineProps<{
  show: boolean
  article: TimelineItem | null
  isPodcastPlaying?: boolean
  index?: number
  hasPrevious?: boolean
  hasNext?: boolean
}>()

const { renderMarkdown } = useMarkdownRenderer()
const feedCoverFailed = ref(false)
const commentsOpen = ref(false)
const commentCount = ref<number | undefined>(undefined)

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

const feedSourceTitle = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  return props.article.feed_item.feed_source?.title || ''
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
.article-toolbar__button:focus-visible,
.article-navigation button:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.article-navigation {
  position: fixed;
  right: min(816px, calc(100vw - 16px));
  top: 50%;
  z-index: calc(var(--a-z-sheet) + 1);
  display: grid;
  gap: 0.5rem;
  transform: translateY(-50%);
}

.article-navigation button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
}

.article-navigation button:hover:not(:disabled) {
  border-color: var(--a-color-text);
}

.article-navigation button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
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

  .article-navigation {
    right: 1rem;
    top: auto;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    grid-template-columns: repeat(2, 44px);
    transform: none;
  }

  .article-navigation button {
    width: 44px;
    height: 44px;
    background: var(--a-color-text);
    color: var(--a-color-bg);
  }
}
</style>
