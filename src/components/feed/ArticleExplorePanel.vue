<template>
  <div v-if="loading" class="feed-loading">
    <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
  </div>

  <PEmpty v-else-if="!items.length" class="a-empty" text="暂无发现内容" />

  <div v-else class="feed-timeline">
    <template v-for="(item, index) in items" :key="itemKey(item)">
      <PEntry
        v-if="item.type === 'feed_item' && item.feed_item"
        :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
        :is-open="showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item)"
        :title="item.feed_item.title"
        :summary="stripHtml(item.feed_item.summary || '')"
        @click="emit('open-article', item, index)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PBadge type="external" fill>外部</PBadge>
            <PBadge type="external">{{ getExternalBadge(item.feed_item) }}</PBadge>
          </div>
        </template>

        <template #meta>
          <button
            v-if="feedItemSource(item.feed_item)"
            type="button"
            class="a-label feed-source-link feed-source-trigger"
            data-test="feed-source-trigger"
            :title="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
            :aria-label="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
            @click.stop="emit('open-source', item.feed_item)"
          >
            {{ feedItemSource(item.feed_item)!.title }}
          </button>
          <span v-else class="a-label a-muted">{{ item.feed_item.feed_source?.title || item.feed_item.author || 'RSS' }}</span>
          <span v-if="item.feed_item.duration" style="color:var(--a-color-muted-soft);font-weight:700">
            时长: {{ item.feed_item.duration }}
          </span>
          <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.feed_item.published_at) }}</span>
        </template>

        <template #actions>
          <PClip
            v-if="item.feed_item.enclosure_url"
            :label="isPodcastPlaying(item.feed_item) ? '■ 播放中' : '▶ 播放播客'"
            @click.stop="emit('play-podcast', item.feed_item)"
          />
          <PClip
            v-if="authStore.isAuthenticated"
            :active="starredIds.has(item.feed_item.id)"
            :label="starredIds.has(item.feed_item.id) ? '取消收藏' : '收藏'"
            @click="emit('toggle-star', item.feed_item.id)"
          />
          <PClip
            v-if="authStore.isAuthenticated"
            :active="readingListIds.has(item.feed_item.id)"
            :label="readingListIds.has(item.feed_item.id) ? '移除' : '稍后阅读'"
            @click="emit('toggle-reading-list', item.feed_item.id)"
          />
          <div style="flex:1"></div>
          <a :href="item.feed_item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
            ↗ 原文
          </a>
        </template>
      </PEntry>
    </template>

    <FeedTimelineFooter
      :page="page"
      :page-size="pageSize"
      :total="totalItems"
      :loading="loading"
      @change-page="emit('change-page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import type { FeedItem, TimelineItem } from '@/types'

const props = defineProps<{
  items: TimelineItem[]
  loading: boolean
  totalItems: number
  page: number
  pageSize: number
  selectedArticle: TimelineItem | null
  showArticleSheet: boolean
  focusedIndex: number
  starredIds: Set<string>
  readingListIds: Set<string>
  feedItemSource: (item: FeedItem) => any
  sourceTriggerLabel: (source: any) => string
}>()

const emit = defineEmits<{
  (e: 'open-article', item: TimelineItem, index: number): void
  (e: 'open-source', item: FeedItem): void
  (e: 'toggle-star', id: string): void
  (e: 'toggle-reading-list', id: string): void
  (e: 'change-page', page: number): void
  (e: 'play-podcast', item: FeedItem): void
}>()

const authStore = useAuthStore()
const playerStore = usePlayerStore()
const uiStore = useUIStore()

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const itemKey = (item: TimelineItem) => `explore-${item.feed_item?.id}`

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

const getExternalBadge = (item: FeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '文章'
}
</script>

<style scoped>
.feed-loading,
.feed-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feed-skeleton {
  height: 7rem;
}

.feed-item-external-link {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-line-soft);
  text-decoration: none;
  transition: all 0.15s;
}

.feed-item-external-link:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}

.feed-source-trigger {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.16em;
  text-transform: none;
  letter-spacing: normal;
}

.feed-source-trigger:hover {
  color: var(--a-color-ink);
  text-decoration-thickness: 2px;
}

.feed-source-trigger:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
}
</style>
