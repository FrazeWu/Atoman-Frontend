import { watch, type ComputedRef, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import type { FeedItem, Subscription, TimelineItem } from '@/types'

interface FeedItemActionsOptions {
  timeline: Ref<TimelineItem[]>
  subscriptions: ComputedRef<Subscription[]>
  readingListIds: ComputedRef<Set<string>>
  allRead: Ref<boolean>
  feedItemActionIDs: (item: FeedItem) => string[]
}

export function useFeedItemActions({
  timeline,
  subscriptions,
  readingListIds,
  allRead,
  feedItemActionIDs,
}: FeedItemActionsOptions) {
  const authStore = useAuthStore()
  const feedStore = useFeedStore()
  const playerStore = usePlayerStore()

  const toggleStar = async (feedItemId: string) => {
    if (!authStore.isAuthenticated) return
    await feedStore.toggleStar(feedItemId)
  }

  const toggleReadingList = async (feedItemId: string) => {
    if (!authStore.isAuthenticated) return
    await feedStore.toggleReadingListItem(feedItemId)
  }

  const toggleRead = (item: TimelineItem) => {
    if (!authStore.isAuthenticated || item.type !== 'feed_item' || !item.feed_item) return
    const itemIDs = feedItemActionIDs(item.feed_item)
    const nextIsRead = !item.is_read
    void (async () => {
      const success = nextIsRead
        ? await feedStore.markItemsRead(itemIDs)
        : await feedStore.markItemsUnread(itemIDs)
      if (!success) return
      item.is_read = nextIsRead
      if (!nextIsRead) allRead.value = false
      await feedStore.fetchSubscriptions()
    })()
  }

  const setTimelineItemsReadState = (ids: string[], isRead: boolean) => {
    const targetIds = new Set(ids)
    timeline.value.forEach((item) => {
      if (item.type === 'feed_item' && item.feed_item && targetIds.has(item.feed_item.id)) {
        item.is_read = isRead
      }
    })
  }

  const markItemsReadAndRefresh = async (ids: string[]) => {
    const success = await feedStore.markItemsRead(ids)
    if (success) {
      await feedStore.fetchSubscriptions()
      return
    }
    setTimelineItemsReadState(ids, false)
  }

  const applyAutomationRules = async (items: TimelineItem[]) => {
    if (!authStore.isAuthenticated) return

    const autoReadSubscriptionSourceIds = new Set(
      subscriptions.value
        .filter((subscription) => subscription.auto_mark_read)
        .map((subscription) => subscription.feed_source?.id || subscription.feed_source_id)
        .filter(Boolean),
    )
    const autoReadingListSubscriptionSourceIds = new Set(
      subscriptions.value
        .filter((subscription) => subscription.auto_add_reading_list)
        .map((subscription) => subscription.feed_source?.id || subscription.feed_source_id)
        .filter(Boolean),
    )
    if (!autoReadSubscriptionSourceIds.size && !autoReadingListSubscriptionSourceIds.size) return

    const pendingReadItems = items.filter((item) => (
      item.type === 'feed_item'
      && item.feed_item
      && !item.is_read
      && autoReadSubscriptionSourceIds.has(item.feed_item.feed_source?.id || item.feed_item.feed_source_id || '')
    ))
    const pendingReadIds = Array.from(new Set(
      pendingReadItems.flatMap((item) => feedItemActionIDs(item.feed_item!)),
    ))

    pendingReadItems.forEach((item) => {
      item.is_read = true
    })

    if (pendingReadIds.length) {
      await markItemsReadAndRefresh(pendingReadIds)
    }

    const pendingReadingListIds = items
      .filter((item) => (
        item.type === 'feed_item'
        && item.feed_item
        && !readingListIds.value.has(item.feed_item.id)
        && autoReadingListSubscriptionSourceIds.has(item.feed_item.feed_source?.id || item.feed_item.feed_source_id || '')
      ))
      .map((item) => item.feed_item!.id)

    for (const feedItemId of pendingReadingListIds) {
      await feedStore.toggleReadingListItem(feedItemId)
    }
  }

  const playFeedItemFromSheet = (feedItem: FeedItem) => {
    playerStore.setQueueFromCurrentItems(timeline.value)

    const timelineItem = timeline.value.find(
      (entry) => entry.type === 'feed_item' && entry.feed_item?.id === feedItem.id,
    )
    if (authStore.isAuthenticated && timelineItem && !timelineItem.is_read) {
      timelineItem.is_read = true
      void markItemsReadAndRefresh(feedItemActionIDs(feedItem))
    }
    const tempSong = playerStore.createPodcastSong(feedItem)
    if (!tempSong) return
    playerStore.playQueuedSong(tempSong)
  }

  const playPodcast = (feedItem: FeedItem, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    playFeedItemFromSheet(feedItem)
  }

  const isPodcastPlaying = (feedItem: FeedItem) => (
    playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying
  )

  watch(subscriptions, async (nextSubscriptions, previousSubscriptions) => {
    if (!authStore.isAuthenticated || !timeline.value.length) return

    const previousCount = previousSubscriptions?.length || 0
    const nextCount = nextSubscriptions.length
    if (!nextCount || nextCount === previousCount) return

    await applyAutomationRules(timeline.value)
  }, { deep: true })

  return {
    toggleStar,
    toggleReadingList,
    toggleRead,
    applyAutomationRules,
    playPodcast,
    isPodcastPlaying,
    playFeedItemFromSheet,
  }
}
