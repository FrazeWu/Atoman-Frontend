<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    close-type="bookmark"
    reading-mode
    :width="'calc(100vw - var(--a-sidebar-width))'"
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
      </div>
      
      <p v-if="article.post.summary" class="article-summary">{{ article.post.summary }}</p>
      <div class="prose-blog article-body" v-html="renderedContent"></div>
    </template>
    
    <template v-else-if="article && article.type === 'feed_item' && article.feed_item">
      <img
        v-if="article.feed_item.image_url"
        :src="article.feed_item.image_url"
        class="article-cover"
      />
      <div class="article-meta">
        <span class="a-label a-muted">{{ article.feed_item.author || article.feed_item.feed_source?.title || 'RSS' }}</span>
        <span style="color:var(--a-color-muted-soft)">{{ formatDate(article.feed_item.published_at) }}</span>
      </div>
      <h1 class="article-title">{{ article.feed_item.title }}</h1>
      <div class="article-subtitle-meta">
        <a :href="article.feed_item.link" target="_blank" rel="noopener noreferrer" class="read-original-link">
          ↗ 阅读原文
        </a>
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
        <PBadge v-if="article.feed_item.full_text_status" :type="article.feed_item.full_text_status === 'success' ? 'internal' : 'external'">
          {{ article.feed_item.full_text_status === 'success' ? 'FULL TEXT' : 'SUMMARY' }}
        </PBadge>
        <div class="prose-blog article-body" v-html="renderFeedHTML(article.feed_item.full_text_html || article.feed_item.summary || '')"></div>
      </div>
      
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FeedItem, TimelineItem } from '@/types'
import DOMPurify from 'dompurify'
import PSheet from '@/components/ui/PSheet.vue'
import PBadge from '@/components/ui/PBadge.vue'
import { modulePathUrl, userUrl } from '@/composables/useSubdomainNav'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'

const props = defineProps<{
  show: boolean
  article: TimelineItem | null
  isPodcastPlaying?: boolean
  index?: number
}>()

const { renderMarkdown } = useMarkdownRenderer()
const renderedContent = computed(() => {
  if (props.article?.type === 'post' && props.article.post?.content) {
    return renderMarkdown(props.article.post.content)
  }
  return ''
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'play-podcast', feedItem: FeedItem): void
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

const { navigateWithShutter } = useAsyncNavigate()

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const renderFeedHTML = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })

const handleReadMore = (post: any) => {
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
  object-fit: cover;
  margin-bottom: 3rem;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
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
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 1rem;
  color: var(--a-color-fg);
  letter-spacing: -0.02em;
}

.article-subtitle-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
}

.read-original-link {
  display: inline-block;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-muted);
  text-decoration: none;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--a-color-line-soft);
  transition: all 0.15s ease;
}

.read-original-link:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
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

.article-body {
  margin-bottom: 4rem;
}

.article-body-wrap {
  display: grid;
  gap: 1rem;
}
</style>
