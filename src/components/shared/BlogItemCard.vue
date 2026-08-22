<template>
  <!-- 1. SHORT NOTE ITEM TYPE -->
  <ShortNoteCard
    v-if="cardType === 'short_note' && shortNoteItem"
    :note="shortNoteItem"
    @delete="emit('delete-note', shortNoteItem)"
  />

  <!-- 2. BLOG POST / FEED ITEM TYPE (PEntry unified wrapper) -->
  <PEntry
    v-else
    :title="displayTitle"
    :summary="displaySummary"
    class="blog-item-card content-stream-entry"
    :class="[`is-type-${cardType}`, { 'is-read': isRead }]"
    :is-focused="isFocused"
    @click="handleClick"
  >
    <!-- Visual / Cover / Avatar -->
    <template #visual>
      <div class="blog-item-card__visual" :class="{ 'is-fallback': !coverUrl || coverImageFailed }">
        <img v-if="coverUrl && !coverImageFailed" :src="coverUrl" :alt="displayTitle" class="blog-item-card__cover" loading="lazy" @error="coverImageFailed = true" />
        <PAvatar
          v-else
          :src="avatarUrl"
          :name="authorName || sourceTitle || displayTitle"
          size="sm"
        />
      </div>
    </template>

    <!-- Meta row -->
    <template #meta>
      <span v-if="authorName" class="blog-item-card__author">{{ authorName }}</span>

      <!-- Channel tag for blog post -->
      <template v-if="postItem?.channel">
        <span class="blog-item-card__dot">·</span>
        <a
          :href="channelUrl(postItem.channel.slug || postItem.channel.id)"
          class="blog-item-card__channel"
          @click.stop
        >
          《{{ postItem.channel.name }}》
        </a>
      </template>

      <!-- Source title for feed item -->
      <template v-else-if="sourceTitle">
        <span class="blog-item-card__dot">·</span>
        <a v-if="sourcePath" :href="sourcePath" class="blog-item-card__source blog-item-card__source-link" @click.stop>{{ sourceTitle }}</a>
        <span v-else class="blog-item-card__source">{{ sourceTitle }}</span>
      </template>

      <!-- External type badge for feed item -->
      <PBadge v-if="cardType === 'feed_item'" type="external" no-dot style="margin-left: 0.25rem;">
        {{ externalBadge }}
      </PBadge>

      <span class="blog-item-card__dot">·</span>
      <time class="blog-item-card__time">{{ formattedDate }}</time>
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

    <template v-if="postItem" #footer>
      <span><Eye :size="13" aria-hidden="true" />{{ formatCount(postItem.view_count) }}</span>
      <span><Gauge :size="13" aria-hidden="true" />评分 {{ formatRating(postItem.rating_score, postItem.rating_count) }}</span>
      <span><Bookmark :size="13" aria-hidden="true" />{{ formatCount(postItem.bookmarks_count) }}</span>
    </template>
  </PEntry>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bookmark, Eye, Gauge } from 'lucide-vue-next'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import EntryActions from '@/components/shared/EntryActions.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import PEntry from '@/components/ui/PEntry.vue'
import type { Post, ShortNote, FeedItem } from '@/types'
import { channelUrl } from '@/router/siteUrls'
import { resolveMediaURL } from '@/utils/mediaUrl'

export type BlogItemType = 'post' | 'short_note' | 'feed_item'

const props = withDefaults(defineProps<{
  item: Post | ShortNote | FeedItem | any
  type?: BlogItemType
  bookmarked?: boolean
  inReadingList?: boolean
  starred?: boolean
  isRead?: boolean
  isFocused?: boolean
  isPodcastPlaying?: boolean
  sourceTitle?: string
  sourcePath?: string
}>(), {
  bookmarked: false,
  inReadingList: false,
  starred: false,
  isRead: false,
  isFocused: false,
  isPodcastPlaying: false,
})

const emit = defineEmits<{
  click: []
  'delete-note': [note: ShortNote]
  'toggle-bookmark': []
  'toggle-reading-list': []
  'toggle-star': []
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

const coverImageFailed = ref(false)

const displayTitle = computed(() => {
  if (postItem.value) return postItem.value.title
  if (feedItem.value) return feedItem.value.title
  if (shortNoteItem.value) return shortNoteItem.value.content?.slice(0, 30) || '短话'
  return props.item.title || ''
})

const displaySummary = computed(() => {
  if (postItem.value) return postItem.value.summary || ''
  if (feedItem.value) return stripHtml(feedItem.value.summary || feedItem.value.content || '')
  return ''
})

const coverUrl = computed(() => {
  if (postItem.value?.cover_url) return resolveMediaURL(postItem.value.cover_url)
  if (feedItem.value?.image_url) return resolveMediaURL(feedItem.value.image_url)
  if (feedItem.value?.feed_source?.cover_url) return resolveMediaURL(feedItem.value.feed_source.cover_url)
  return ''
})

watch(coverUrl, () => {
  coverImageFailed.value = false
})

const avatarUrl = computed(() => {
  if (postItem.value?.user?.avatar_url) return resolveMediaURL(postItem.value.user.avatar_url)
  if (feedItem.value?.feed_source?.cover_url) return resolveMediaURL(feedItem.value.feed_source.cover_url)
  return ''
})

const authorName = computed(() => {
  if (postItem.value?.user) return postItem.value.user.display_name || postItem.value.user.username || ''
  return ''
})

const sourceTitle = computed(() => {
  if (feedItem.value?.feed_source) return feedItem.value.feed_source.title || ''
  return props.sourceTitle || ''
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
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
})

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').trim()
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
  if (!count) return '— (0)'
  return `${Number(score || 0).toFixed(1)} (${count})`
}

</script>

<style scoped>
.blog-item-card__visual {
  width: 7rem;
  aspect-ratio: 4 / 3;
  height: auto;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
  box-shadow: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.blog-item-card:hover .blog-item-card__visual {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.blog-item-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.blog-item-card:hover .blog-item-card__cover {
  transform: scale(1.05);
}

.blog-item-card__visual.is-fallback :deep(.p-avatar) {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
}

.blog-item-card__author {
  font-weight: 600;
  color: var(--a-color-fg);
}

.blog-item-card__dot {
  color: var(--a-color-muted-soft);
  margin: 0 0.25rem;
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

.blog-item-card__source-link {
  text-decoration: none;
}

.blog-item-card__source-link:hover {
  color: var(--a-color-primary, #3b82f6);
}

.blog-item-card__time {
  color: var(--a-color-muted-soft);
}

@media (max-width: 640px) {
  .blog-item-card__visual {
    width: 5.5rem;
  }
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
