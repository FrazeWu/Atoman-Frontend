<template>
  <!-- 1. SHORT NOTE ITEM TYPE -->
  <ShortNoteCard
    v-if="cardType === 'short_note' && shortNoteItem"
    :note="shortNoteItem"
    @delete="emit('delete-note', shortNoteItem)"
  />

  <!-- 2. BLOG POST / FEED ITEM TYPE (PContentCard unified wrapper - 方案 1 极简流式行) -->
  <PContentCard
    v-else
    :title="displayTitle"
    :summary="displaySummary"
    class="blog-item-card content-stream-entry"
    :class="[`is-type-${cardType}`, { 'is-read': isRead }]"
    :is-open="isOpen"
    :is-focused="isFocused"
    @click="handleClick"
  >
    <template #visual>
      <PAvatar
        v-if="cardType === 'post'"
        :src="postItem?.user?.avatar_url"
        :name="authorName"
        :alt="`${authorName} 的头像`"
        size="xs"
      />
      <PAvatar
        v-else
        :src="feedItem?.feed_source?.cover_url || feedItem?.image_url"
        :name="sourceTitle"
        :alt="`${sourceTitle} 的网站图标`"
        size="xs"
      />
    </template>

    <!-- Meta row (单行集中一体化 Meta) -->
    <template #meta>
      <span v-if="authorName" class="blog-item-card__author">{{ authorName }}</span>
      <span v-if="authorUsername" class="blog-item-card__handle">@{{ authorUsername }}</span>

      <!-- Source title for blog post or feed item -->
      <template v-if="postItem?.channel || sourceTitle">
        <button
          v-if="sourceInteractive && sourceTitle"
          type="button"
          class="blog-item-card__source blog-item-card__source-button"
          data-test="feed-source-trigger"
          :title="`查看 ${sourceTitle} 的所有文章`"
          :aria-label="`查看 ${sourceTitle} 的所有文章`"
          @click.stop="emit('open-source')"
        >{{ sourceTitle }}</button>
        <a
          v-else-if="postItem?.channel"
          :href="channelUrl(postItem.channel.slug || postItem.channel.id)"
          class="blog-item-card__channel"
          @click.stop
        >
          《{{ postItem.channel.name }}》
        </a>
        <a v-else-if="sourcePath" :href="sourcePath" class="blog-item-card__source blog-item-card__source-link" @click.stop>{{ sourceTitle }}</a>
        <span v-else class="blog-item-card__source">{{ sourceTitle }}</span>
      </template>

      <slot name="meta-extra" />

      <!-- 统计指标：阅读、评分、收藏 -->
      <span class="feed-entry-stats">
        <span v-if="postItem" class="feed-meta-stat"><Eye :size="11" aria-hidden="true" />{{ formatCount(postItem.view_count) }}</span>
        <span v-else-if="feedItem" class="feed-meta-stat"><Eye :size="11" aria-hidden="true" />{{ formatCount(feedItem.read_count) }}</span>

        <span v-if="postItem" class="feed-meta-stat"><Gauge :size="11" aria-hidden="true" />{{ formatRating(postItem.rating_score, postItem.rating_count) }}</span>
        <span v-else-if="feedItem" class="feed-meta-stat"><Gauge :size="11" aria-hidden="true" />{{ formatRating(feedItem.rating_score, feedItem.rating_count) }}</span>

        <span v-if="postItem" class="feed-meta-stat"><Bookmark :size="11" aria-hidden="true" />{{ formatCount(postItem.bookmarks_count) }}</span>
        <span v-else-if="feedItem" class="feed-meta-stat"><Bookmark :size="11" aria-hidden="true" />{{ formatCount(feedItem.bookmark_count) }}</span>
      </span>

      <!-- 日期 -->
      <time class="blog-item-card__time">{{ formattedDate }}</time>

      <!-- 彩色类型胶囊 -->
      <span
        class="feed-type-tag"
        :class="cardType === 'post' ? 'feed-type-tag--blog' : 'feed-type-tag--rss'"
      >
        {{ cardType === 'post' ? '博客' : typeLabel || externalBadge }}
      </span>
    </template>

    <!-- Actions slot / EntryActions -->
    <template #actions>
      <slot name="actions">
        <!-- Optional podcast player clip -->
        <PClip
          v-if="cardType === 'feed_item' && feedItem?.enclosure_url"
          :label="isPodcastPlaying ? '■ 播放中' : '▶ 播放播客'"
          @click="emit('play-podcast', feedItem)"
        />

        <EntryActions
          :bookmarked="bookmarked"
          :in-reading-list="inReadingList"
          :starred="starred"
          :show-star="cardType === 'feed_item'"
          :show-labels="false"
          @toggle-bookmark="emit('toggle-bookmark')"
          @toggle-reading-list="emit('toggle-reading-list')"
          @toggle-star="emit('toggle-star')"
        />

        <slot v-if="sourceTitle" name="source-action" />

        <a
          v-if="cardType === 'feed_item' && feedItem?.link"
          :href="feedItem.link"
          target="_blank"
          rel="noopener noreferrer"
          class="blog-item-card__external-link"
          @click.stop
        >
          ↗ 原文
        </a>
      </slot>
    </template>
  </PContentCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark, Eye, Gauge } from 'lucide-vue-next'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import EntryActions from '@/components/shared/EntryActions.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PClip from '@/components/ui/PClip.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import type { Post, ShortNote, FeedItem } from '@/types'
import { channelUrl } from '@/router/siteUrls'

export type BlogItemType = 'post' | 'short_note' | 'feed_item'

const props = withDefaults(defineProps<{
  item: Post | ShortNote | FeedItem | any
  type?: BlogItemType
  bookmarked?: boolean
  inReadingList?: boolean
  starred?: boolean
  isRead?: boolean
  isOpen?: boolean
  isFocused?: boolean
  isPodcastPlaying?: boolean
  sourceTitle?: string
  sourcePath?: string
  sourceInteractive?: boolean
  typeLabel?: string
}>(), {
  bookmarked: false,
  inReadingList: false,
  starred: false,
  isRead: false,
  isOpen: false,
  isFocused: false,
  isPodcastPlaying: false,
  sourceInteractive: false,
  typeLabel: '',
})

const emit = defineEmits<{
  click: []
  'delete-note': [note: ShortNote]
  'toggle-bookmark': []
  'toggle-reading-list': []
  'toggle-star': []
  'open-source': []
  'play-podcast': [item: FeedItem]
}>()

// 自动识别 Card 类型
const cardType = computed<BlogItemType>(() => {
  if (props.type) return props.type
  if ('media' in props.item && Array.isArray(props.item.media)) return 'short_note'
  if ('feed_item' in props.item || 'enclosure_url' in props.item || 'duplicate_count' in props.item) return 'feed_item'
  return 'post'
})

const postItem = computed<Post | null>(() => (cardType.value === 'post' ? (props.item as Post) : null))
const shortNoteItem = computed<ShortNote | null>(() => (cardType.value === 'short_note' ? (props.item as ShortNote) : null))
const feedItem = computed<FeedItem | null>(() => {
  if (cardType.value !== 'feed_item') return null
  return (props.item.feed_item || props.item) as FeedItem
})

const displayTitle = computed(() => {
  if (postItem.value) return postItem.value.title
  if (feedItem.value) return feedItem.value.title
  if (shortNoteItem.value) return shortNoteItem.value.content?.slice(0, 30) || '短笺'
  return props.item.title || ''
})

const displaySummary = computed(() => {
  if (postItem.value) return postItem.value.summary?.trim() || markdownExcerpt(postItem.value.content || '')
  if (feedItem.value) return stripHtml(feedItem.value.summary || feedItem.value.content || '')
  return ''
})

const authorName = computed(() => {
  if (postItem.value?.user) return postItem.value.user.display_name || postItem.value.user.username || ''
  return ''
})

const authorUsername = computed(() => postItem.value?.user?.username || '')

const sourceTitle = computed(() => {
  if (props.sourceTitle) return props.sourceTitle
  if (feedItem.value?.feed_source) return feedItem.value.feed_source.title || ''
  return ''
})

const sourcePath = computed(() => props.sourcePath || '')

const externalBadge = computed(() => {
  if (feedItem.value?.feed_source?.source_type) {
    return feedItem.value.feed_source.source_type.replace('external_', '').replace('internal_', '').toUpperCase()
  }
  return 'RSS'
})

const formattedDate = computed(() => {
  const dateStr = postItem.value?.created_at || feedItem.value?.published_at || props.item.created_at || ''
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
})

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').trim()
}

function markdownExcerpt(content: string): string {
  const summarySection = content.match(/(?:^|\n)#{1,6}\s*(?:摘要|概述|abstract)\s*\n+([\s\S]*)/i)
  const excerptSource = summarySection?.[1] || content

  return stripHtml(excerptSource)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function handleClick() {
  emit('click')
}

function formatCount(value?: number) {
  if (value === undefined || value === null) return '0'
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
  return String(value)
}

function formatRating(score?: number, count?: number) {
  if (!count) return '—'
  return `${Number(score || 0).toFixed(1)} (${count})`
}
</script>

<style scoped>
.blog-item-card__author {
  font-weight: 600;
  color: var(--a-color-fg);
}

.blog-item-card__handle {
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
}

.blog-item-card__channel {
  color: var(--a-color-text);
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.blog-item-card__channel:hover {
  color: var(--a-color-primary, #3b82f6);
}

.blog-item-card__source {
  color: var(--a-color-muted);
}

.blog-item-card__source-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.blog-item-card__source-button:hover,
.blog-item-card__source-button:focus-visible {
  color: var(--a-color-primary, #3b82f6);
  text-decoration: underline;
}

.blog-item-card__source-button:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-text));
  outline-offset: 2px;
}

.blog-item-card__source-link {
  text-decoration: none;
}

.blog-item-card__source-link:hover {
  color: var(--a-color-primary, #3b82f6);
}

.blog-item-card__time {
  color: var(--a-color-muted-soft);
}

.feed-meta-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
  font-weight: 500;
}

.feed-type-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1em 0.45em;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.5;
}
.feed-type-tag--blog {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: #16a34a;
}
.feed-type-tag--rss {
  background: color-mix(in srgb, #2563eb 12%, transparent);
  color: #2563eb;
}

.blog-item-card__external-link {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  text-decoration: none;
  margin-left: 0.5rem;
  transition: color 0.15s ease;
}

.blog-item-card__external-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
</style>
