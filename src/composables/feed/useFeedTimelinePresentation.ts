import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type { FeedItem, Subscription, TimelineItem } from '@/types'
import { findSubscriptionByTimelineItem } from '@/utils/feedSubscriptions'

export type FeedSourceTypeFilter = 'all' | 'internal' | 'blog' | 'podcast'

interface FeedTimelinePresentationOptions {
  timeline: Ref<TimelineItem[]>
  subscriptions: ComputedRef<Subscription[]>
  querySourceId: ComputedRef<string | null>
  sourceTypeFilter: Ref<FeedSourceTypeFilter>
  activeTheme: Ref<string>
  hiddenKeywords: ComputedRef<string[]>
}

const getExternalBadge = (item: FeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '文章'
}

const matchesSourceTypeFilter = (item: TimelineItem, filter: FeedSourceTypeFilter) => {
  if (filter === 'all') return true
  if (filter === 'internal') return item.type === 'post'
  if (item.type !== 'feed_item' || !item.feed_item) return false

  const badge = getExternalBadge(item.feed_item)
  if (filter === 'podcast') return badge === '播客'
  if (filter === 'blog') return badge === '文章'
  return true
}

const extractThemesFromItem = (item: TimelineItem) => {
  const parts = item.type === 'feed_item'
    ? [
        item.feed_item?.title || '',
        item.feed_item?.summary || '',
        item.feed_item?.feed_source?.title || '',
      ]
    : [
        item.post?.title || '',
        item.post?.summary || '',
        item.post?.channel?.name || '',
      ]

  const matches = parts.join(' ').match(/\b[A-Z][A-Z0-9+\-]{1,}\b/g) || []
  return Array.from(new Set(matches.map((value) => value.trim()).filter(Boolean)))
}

const matchesThemeFilter = (item: TimelineItem, theme: string) =>
  !theme || extractThemesFromItem(item).includes(theme)

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()

const itemKey = (item: TimelineItem) => {
  if (item.type === 'post' && item.post) return `post-${item.post.id}`
  if (item.type === 'feed_item' && item.feed_item) return `feed-${item.feed_item.id}`
  return `${item.type}-${item.published_at || ''}`
}

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const feedItemActionIDs = (feedItem: FeedItem) => Array.from(new Set([
  feedItem.id,
  ...(feedItem.duplicate_item_ids || []),
].filter(Boolean)))

export function useFeedTimelinePresentation({
  timeline,
  subscriptions,
  querySourceId,
  sourceTypeFilter,
  activeTheme,
  hiddenKeywords,
}: FeedTimelinePresentationOptions) {
  const expandedDuplicateItemIds = ref(new Set<string>())

  const visibleTimeline = computed(() => {
    const normalizedHiddenKeywords = hiddenKeywords.value.map((keyword) => keyword.toLocaleLowerCase())

    return timeline.value.filter((item) => {
      if (!matchesSourceTypeFilter(item, sourceTypeFilter.value)) return false
      if (!matchesThemeFilter(item, activeTheme.value)) return false
      if (
        !querySourceId.value
        && findSubscriptionByTimelineItem(item, subscriptions.value)?.is_muted
      ) return false
      if (!normalizedHiddenKeywords.length) return true

      const title = item.type === 'feed_item' ? (item.feed_item?.title || '') : (item.post?.title || '')
      const summary = item.type === 'feed_item'
        ? stripHtml(item.feed_item?.summary || '')
        : (item.post?.summary || '')
      const haystack = `${title}\n${summary}`.toLocaleLowerCase()
      return !normalizedHiddenKeywords.some((keyword) => haystack.includes(keyword))
    })
  })

  const themeFilters = computed(() => {
    const counts = new Map<string, number>()
    timeline.value.forEach((item) => {
      extractThemesFromItem(item).forEach((theme) => {
        counts.set(theme, (counts.get(theme) || 0) + 1)
      })
    })

    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([theme]) => theme)
  })

  const toggleDuplicateSources = (feedItemID: string) => {
    const next = new Set(expandedDuplicateItemIds.value)
    if (next.has(feedItemID)) next.delete(feedItemID)
    else next.add(feedItemID)
    expandedDuplicateItemIds.value = next
  }

  return {
    visibleTimeline,
    themeFilters,
    expandedDuplicateItemIds,
    getExternalBadge,
    feedItemActionIDs,
    itemKey,
    formatDate,
    stripHtml,
    toggleDuplicateSources,
  }
}
