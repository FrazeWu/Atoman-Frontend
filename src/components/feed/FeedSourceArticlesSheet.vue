<template>
  <PSheet
    :show="show"
    close-type="header"
    reading-mode
    :width="'calc(100vw - var(--a-sidebar-width))'"
    @close="$emit('close')"
  >
    <template #header>
      <div
        class="source-sheet-header"
        :style="{ '--feed-source-color': sourceColor }"
      >
        <div class="source-sheet-hero">
          <span class="source-sheet-kicker">{{ sourceTypeLabel }}</span>
          <span class="source-sheet-url" data-test="feed-source-url">{{ sourceUrl }}</span>
        </div>

        <div class="source-sheet-heading">
          <div
            class="source-sheet-avatar"
            data-test="feed-source-avatar"
            :style="{ '--feed-source-color': sourceColor }"
          >
            {{ sourceAvatarLabel }}
          </div>

          <div class="source-sheet-copy">
            <h2 data-test="feed-source-title">{{ sourceTitle }}</h2>
            <div class="source-sheet-meta">
              <span v-if="sourceHealthLabel">{{ sourceHealthLabel }}</span>
              <span v-if="sourceItemCountLabel">{{ sourceItemCountLabel }}</span>
              <span v-if="sourceCadenceLabel">{{ sourceCadenceLabel }}</span>
              <span v-if="sourceCheckedAtLabel">{{ sourceCheckedAtLabel }}</span>
            </div>
          </div>
        </div>

        <PPress
          v-if="source"
          :label="source.subscribed ? '已订阅' : '订阅'"
          :variant="source.subscribed ? 'secondary' : 'primary'"
          :disabled="source.subscribed || subscribeBusy"
          :loading="subscribeBusy"
          loading-text="处理中..."
          @click="$emit('subscribe')"
        />
      </div>
    </template>

    <div class="source-sheet-body">
      <div class="source-sheet-search">
        <input
          v-model="searchQuery"
          data-test="source-search-input"
          class="source-search-input"
          type="search"
          placeholder="搜索此来源内的文章"
          aria-label="搜索此来源内的文章"
        />
        <select
          v-model="sortMode"
          data-test="source-sort-select"
          class="source-sort-select"
          aria-label="来源文章排序"
        >
          <option value="newest">最新</option>
          <option value="oldest">最旧</option>
          <option value="title">标题</option>
        </select>
      </div>

      <div v-if="loading" class="source-sheet-loading">
        <div v-for="i in 4" :key="i" class="a-skeleton source-sheet-skeleton" />
      </div>

      <PEmpty
        v-else-if="!visibleItems.length"
        title="暂无文章"
        description="这个来源暂时没有可显示的内容"
      />

      <div v-else class="source-article-list">
        <button
          v-for="item in visibleItems"
          :key="itemKey(item)"
          type="button"
          class="source-article-row"
          data-test="source-article-row"
          @click="$emit('open-article', item)"
        >
          <span class="source-article-date">{{ formatDate(item.published_at) }}</span>
          <span class="source-article-title">{{ itemTitle(item) }}</span>
          <span v-if="itemSummary(item)" class="source-article-summary">{{ itemSummary(item) }}</span>
        </button>
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { FeedArticleSource, TimelineItem } from '@/types'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPress from '@/components/ui/PPress.vue'
import PSheet from '@/components/ui/PSheet.vue'
import {
  buildSourceAvatarLabel,
  buildSourceColor,
  normalizeSourceUrlForCard,
} from '@/utils/feedSourcePresentation'

const props = withDefaults(defineProps<{
  show: boolean
  source: FeedArticleSource | null
  items: TimelineItem[]
  loading?: boolean
  subscribeBusy?: boolean
}>(), {
  loading: false,
  subscribeBusy: false,
})

defineEmits<{
  (e: 'close'): void
  (e: 'subscribe'): void
  (e: 'open-article', item: TimelineItem): void
}>()

const sourceTypeLabel = computed(() => {
  if (props.source?.type === 'internal_channel') return '频道'
  if (props.source?.type === 'external_rss') return 'RSS 源'
  return '来源'
})

const sourceTitle = computed(() => props.source?.title?.trim() || '来源')

const sourceUrl = computed(() => {
  if (props.source?.rssUrl) return props.source.rssUrl
  return normalizeSourceUrlForCard(undefined, sourceTitle.value)
})

const sourceAvatarLabel = computed(() => buildSourceAvatarLabel(sourceTitle.value))

const sourceColor = computed(() => buildSourceColor(props.source?.rssUrl || sourceTitle.value))
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'title'>('newest')

const sourceHealthLabel = computed(() => {
  const status = (props.source as any)?.healthStatus
  if (status === 'healthy') return '状态正常'
  if (status === 'warning') return '状态警告'
  if (status === 'error') return '状态异常'
  return ''
})

const sourceCheckedAtLabel = computed(() => {
  const value = (props.source as any)?.lastCheckedAt
  if (!value) return ''
  return formatDateTime(value)
})

const sourceItemCountLabel = computed(() => {
  const count = (props.source as any)?.itemCount
  if (typeof count !== 'number') return ''
  return `共 ${count} 篇`
})

const sourceCadenceLabel = computed(() => {
  const timestamps = props.items
    .map((item) => new Date(item.published_at || '').getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)

  if (timestamps.length < 2) return ''

  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) {
    const diff = timestamps[i - 1] - timestamps[i]
    if (diff > 0) intervals.push(diff)
  }

  if (!intervals.length) return ''

  const averageMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
  const averageDays = averageMs / (1000 * 60 * 60 * 24)

  if (averageDays < 1.5) return '约每天更新一次'
  if (averageDays < 7) return `约每 ${Math.round(averageDays)} 天更新一次`
  const averageWeeks = Math.max(1, Math.round(averageDays / 7))
  return averageWeeks === 1 ? '约每周更新一次' : `约每 ${averageWeeks} 周更新一次`
})

const visibleItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const filteredItems = !query ? props.items : props.items.filter((item) => {
    const haystack = `${itemTitle(item)} ${itemSummary(item)}`.toLocaleLowerCase()
    return haystack.includes(query)
  })

  return [...filteredItems].sort((left, right) => compareItems(left, right, sortMode.value))
})

function itemKey(item: TimelineItem): string {
  if (item.type === 'post' && item.post) return `post-${item.post.id}`
  if (item.type === 'feed_item' && item.feed_item) return `feed-${item.feed_item.id}`
  return `${item.type}-${item.published_at}`
}

function itemTitle(item: TimelineItem): string {
  if (item.type === 'post' && item.post) return item.post.title
  if (item.type === 'feed_item' && item.feed_item) return item.feed_item.title
  return '未命名文章'
}

function itemSummary(item: TimelineItem): string {
  if (item.type === 'post' && item.post) return item.post.summary || stripText(item.post.content)
  if (item.type === 'feed_item' && item.feed_item) return stripText(item.feed_item.summary || '')
  return ''
}

function stripText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function formatDate(date?: string): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDateTime(date?: string): string {
  if (!date) return ''
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return date
  const pad = (unit: number) => String(unit).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function compareItems(left: TimelineItem, right: TimelineItem, mode: 'newest' | 'oldest' | 'title') {
  if (mode === 'title') {
    return itemTitle(left).localeCompare(itemTitle(right), 'zh-CN')
  }

  const leftTime = new Date(left.published_at || '').getTime()
  const rightTime = new Date(right.published_at || '').getTime()
  const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime
  const safeRight = Number.isNaN(rightTime) ? 0 : rightTime

  if (mode === 'oldest') return safeLeft - safeRight
  return safeRight - safeLeft
}
</script>

<style scoped>
.source-sheet-header {
  display: grid;
  width: 100%;
  gap: 1rem;
  padding: 0.35rem 0 0.25rem;
}

.source-sheet-hero {
  --hero-wash: color-mix(in srgb, var(--feed-source-color) 14%, white);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border: 1px solid color-mix(in srgb, var(--feed-source-color) 22%, var(--a-color-line-soft));
  border-radius: 4px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--feed-source-color) 34%, white) 0%, transparent 46%),
    linear-gradient(135deg, color-mix(in srgb, var(--feed-source-color) 16%, white) 0%, var(--hero-wash) 100%);
}

.source-sheet-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.source-sheet-copy {
  min-width: 0;
  flex: 1;
}

.source-sheet-avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 3.35rem;
  height: 3.35rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--feed-source-color) 18%, white);
  color: color-mix(in srgb, var(--feed-source-color) 74%, black);
  font-size: 1.2rem;
  font-weight: 500;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--feed-source-color) 24%, white);
}

.source-sheet-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.2rem 0.72rem;
  border-radius: 0px;
  background: rgba(255, 255, 255, 0.72);
  color: color-mix(in srgb, var(--feed-source-color) 72%, black);
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0;
}

.source-sheet-url {
  color: var(--a-color-fg);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.source-sheet-copy h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.25rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.source-sheet-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.45rem;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.source-sheet-body {
  display: grid;
  gap: 1rem;
  padding: 1.5rem 2.5rem 4rem;
}

.source-sheet-search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.source-search-input {
  flex: 1;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0.8rem 0.95rem;
  font-size: 0.9rem;
}

.source-sort-select {
  min-width: 8rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0.8rem 0.95rem;
  font-size: 0.85rem;
}

.source-sheet-loading,
.source-article-list {
  display: grid;
  gap: 0.8rem;
}

.source-sheet-skeleton {
  height: 5.5rem;
}

.source-article-row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.35rem 1rem;
  width: 100%;
  padding: 1rem 0;
  border: 0;
  border-bottom: 1px dashed var(--a-color-line-soft);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.source-article-row:hover .source-article-title,
.source-article-row:focus-visible .source-article-title {
  color: var(--a-color-ink);
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.source-article-date {
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 500;
}

.source-article-title {
  color: var(--a-color-fg);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.35;
}

.source-article-summary {
  grid-column: 2;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  line-height: 1.55;
}

@media (max-width: 720px) {
  .source-sheet-header {
    gap: 0.85rem;
  }

  .source-sheet-hero,
  .source-sheet-heading {
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
  }

  .source-sheet-avatar {
    width: 3rem;
    height: 3rem;
  }

  .source-sheet-body {
    padding: 1.25rem 1.25rem 3rem;
  }

  .source-article-row {
    grid-template-columns: 1fr;
  }

  .source-article-summary {
    grid-column: 1;
  }
}
</style>
