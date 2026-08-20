<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    close-type="bookmark"
    reading-mode
    :index="index"
    @close="$emit('close')"
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
        <span class="a-label a-muted">{{ article.feed_item.author || article.feed_item.feed_source?.title || 'RSS' }}</span>
        <span style="color:var(--a-color-muted-soft)">{{ formatDate(article.feed_item.published_at) }}</span>
      </div>
      <h1 class="article-title">{{ article.feed_item.title }}</h1>
      <div class="article-context-meta">
        <span v-if="feedSourceTitle" class="article-context-chip">{{ feedSourceTitle }}</span>
        <span v-if="feedContentStateLabel" class="article-context-chip">{{ feedContentStateLabel }}</span>
        <span v-if="feedWordCountLabel" class="article-context-chip">{{ feedWordCountLabel }}</span>
        <span v-if="feedFetchedAtLabel" class="article-context-chip">{{ feedFetchedAtLabel }}</span>
      </div>
      <div class="article-subtitle-meta">
        <a :href="article.feed_item.link" target="_blank" rel="noopener noreferrer" class="read-original-link">
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
        <button
          v-if="isPlayablePodcast"
          type="button"
          class="read-original-link article-play-link"
          data-test="feed-article-play"
          @click="emitPlayPodcast"
        >
          {{ isPodcastPlaying ? '■ 播放中' : '▶ 播放播客' }}
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
      <CommentSection :target="{ kind: 'feed_article', resourceId: article.feed_item.id }" />
      
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FeedItem, Post, TimelineItem } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PBadge from '@/components/ui/PBadge.vue'
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

const feedCoverUrl = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item) return ''
  const rawURL = props.article.feed_item.image_url || props.article.feed_item.feed_source?.cover_url || ''
  return rawURL ? resolveMediaURL(rawURL) : ''
})

watch(() => props.article?.feed_item?.id, () => {
  feedCoverFailed.value = false
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
  if (props.article?.type !== 'feed_item' || !props.article.feed_item?.full_text_word_count) return ''
  return `约 ${props.article.feed_item.full_text_word_count} 字`
})

const feedFetchedAtLabel = computed(() => {
  if (props.article?.type !== 'feed_item' || !props.article.feed_item?.fetched_at) return ''
  return `抓取于 ${formatDate(props.article.feed_item.fetched_at)}`
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
  gap: 1rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.article-title {
  font-family: inherit;
  font-size: 2.25rem;
  font-weight: 500;
  line-height: 1.15;
  margin-bottom: 1rem;
  color: var(--a-color-fg);
  letter-spacing: 0;
}

.article-subtitle-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
}

.article-context-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 1rem;
}

.article-context-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding: 0.2rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: 0;
}

.read-original-link {
  display: inline-block;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-muted);
  text-decoration: none;
  letter-spacing: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  transition: all 0.15s ease;
}

.read-original-link:hover {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

.article-nav-link {
  cursor: pointer;
  background: var(--a-color-bg);
}

.article-play-link {
  cursor: pointer;
  background: var(--a-color-bg);
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
  font-size: 0.84rem;
  line-height: 1.6;
}
</style>
