import { apiRequestResult } from '@/api/client'
import { loadReadingListFeedItemIds, loadStarredFeedItemIds } from '@/api/feedMembership'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'
import { ref } from 'vue'

export function createFeedMembershipState() {
  const api = useApi()

  // --- Star Actions ---

  const starredItemIds = ref<Set<string>>(new Set())
  const bookmarkedPostIds = ref<Set<string>>(new Set())
  const readingListItemIds = ref<Set<string>>(new Set())
  type PendingMembershipToggle = {
    confirmed: boolean
    desired: boolean
    inFlight: boolean
    waiters: Array<(value: boolean | null) => void>
  }
  const starToggleStates = new Map<string, PendingMembershipToggle>()
  const readingListToggleStates = new Map<string, PendingMembershipToggle>()
  let starMembershipRevision = 0
  let readingListMembershipRevision = 0
  let sessionGeneration = 0

  const setMembership = (ids: typeof starredItemIds, id: string, shouldInclude: boolean) => {
    const next = new Set(ids.value)
    if (shouldInclude) {
      next.add(id)
    } else {
      next.delete(id)
    }
    ids.value = next
  }

  const mergePendingMembership = (
    ids: Set<string>,
    states: Map<string, PendingMembershipToggle>,
  ) => {
    const next = new Set(ids)
    states.forEach((state, id) => {
      if (state.desired) {
        next.add(id)
      } else {
        next.delete(id)
      }
    })
    return next
  }

  const enqueueMembershipToggle = (
    states: Map<string, PendingMembershipToggle>,
    ids: typeof starredItemIds,
    id: string,
    requestToggle: (fallback: boolean) => Promise<boolean | null>,
    generation: number,
  ): Promise<boolean | null> => {
    const currentLocal = ids.value.has(id)
    let state = states.get(id)
    if (!state) {
      state = {
        confirmed: currentLocal,
        desired: currentLocal,
        inFlight: false,
        waiters: [],
      }
      states.set(id, state)
    }

    state.desired = !currentLocal
    setMembership(ids, id, state.desired)

    const result = new Promise<boolean | null>((resolve) => {
      state?.waiters.push(resolve)
    })
    if (!state.inFlight) {
      void drainMembershipToggle(states, ids, id, state, requestToggle, generation)
    }
    return result
  }

  const drainMembershipToggle = async (
    states: Map<string, PendingMembershipToggle>,
    ids: typeof starredItemIds,
    id: string,
    state: PendingMembershipToggle,
    requestToggle: (fallback: boolean) => Promise<boolean | null>,
    generation: number,
  ) => {
    state.inFlight = true
    let finalState: boolean | null = state.confirmed

    while (state.desired !== state.confirmed) {
      const fallback = !state.confirmed
      const serverState = await requestToggle(fallback)
      if (generation !== sessionGeneration) {
        state.inFlight = false
        state.waiters.splice(0).forEach((resolve) => resolve(null))
        return
      }
      if (serverState === null) {
        finalState = null
        state.desired = state.confirmed
        setMembership(ids, id, state.confirmed)
        break
      }

      state.confirmed = serverState
      finalState = serverState
      if (state.desired !== state.confirmed) {
        setMembership(ids, id, state.desired)
      }
    }

    if (finalState !== null) {
      setMembership(ids, id, state.confirmed)
      finalState = state.confirmed
    }
    state.inFlight = false
    const waiters = state.waiters.splice(0)
    waiters.forEach((resolve) => resolve(finalState))
    if (state.desired === state.confirmed && state.waiters.length === 0) {
      states.delete(id)
    }
  }

  const requestStarToggle = async (feedItemId: string, fallback: boolean): Promise<boolean | null> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequestResult(`${api.url}/feed/timeline/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
      if (res.ok) {
        const data = res.data
        const starred = data.data?.starred ?? data.starred ?? fallback
        return Boolean(starred)
      }
    } catch (e) {
      reportError(e, 'Failed to toggle star')
    }
    return null
  }

  const toggleStar = async (feedItemId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    starMembershipRevision += 1
    return enqueueMembershipToggle(
      starToggleStates,
      starredItemIds,
      feedItemId,
      (fallback) => requestStarToggle(feedItemId, fallback),
      sessionGeneration,
    )
  }

  const fetchStarredIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      starredItemIds.value = new Set()
      return
    }
    const revision = starMembershipRevision
    try {
      const ids = await loadStarredFeedItemIds(api.url, authStore.token)
      if (revision !== starMembershipRevision) return
      starredItemIds.value = mergePendingMembership(new Set(ids), starToggleStates)
    } catch (e) {
      reportError(e, 'Failed to fetch starred ids')
    }
  }

  const fetchBookmarkedPostIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      bookmarkedPostIds.value = new Set()
      return
    }
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/blog/bookmarks`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = res.data
        if (generation !== sessionGeneration) return
        const bookmarks = (data.data || []) as Array<{ content_id?: unknown; post_id?: unknown }>
        const ids = bookmarks
          .map((bookmark) => {
            if (typeof bookmark.post_id === 'string') return bookmark.post_id
            return typeof bookmark.content_id === 'string' ? bookmark.content_id : ''
          })
          .filter(Boolean)
        bookmarkedPostIds.value = new Set(ids)
      }
    } catch (e) {
      reportError(e, 'Failed to fetch bookmarked post ids')
    }
  }

  const togglePostBookmark = async (postId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    const generation = sessionGeneration
    try {
      if (bookmarkedPostIds.value.has(postId)) {
        const res = await apiRequestResult(`${api.url}/blog/bookmarks`, {
          headers: { Authorization: `Bearer ${authStore.token}` },
        })
        if (!res.ok) return null
        const data = res.data
        const bookmark = (data.data || []).find((item: { content_id?: unknown; post_id?: unknown }) =>
          item.post_id === postId || item.content_id === postId,
        ) as { id?: string } | undefined
        if (!bookmark?.id) return null
        const deleteRes = await apiRequestResult(`${api.url}/blog/bookmarks/${bookmark.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` },
        })
        if (!deleteRes.ok || generation !== sessionGeneration) return null
        const newSet = new Set(bookmarkedPostIds.value)
        newSet.delete(postId)
        bookmarkedPostIds.value = newSet
        return false
      }

      const res = await apiRequestResult(`${api.url}/blog/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ content_id: postId }),
      })
      if (res.ok && generation === sessionGeneration) {
        const newSet = new Set(bookmarkedPostIds.value)
        newSet.add(postId)
        bookmarkedPostIds.value = newSet
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to toggle post bookmark')
    }
    return null
  }

  // Store does not own paged starred lists; callers should update local lists or refetch after success.
  const moveStarToGroup = async (feedItemId: string, groupId: string | null): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await apiRequestResult(`${api.url}/feed/stars/${feedItemId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ group_id: groupId }),
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to move star to group')
    }
    return false
  }

  const syncStarredPageIds = (previousIds: string[], nextIds: string[]) => {
    const next = new Set(starredItemIds.value)
    previousIds.forEach((id) => next.delete(id))
    nextIds.forEach((id) => next.add(id))
    starredItemIds.value = mergePendingMembership(
      next,
      starToggleStates,
    )
  }

  const syncReadingListPageIds = (previousIds: string[], nextIds: string[]) => {
    const next = new Set(readingListItemIds.value)
    previousIds.forEach((id) => next.delete(id))
    nextIds.forEach((id) => next.add(id))
    readingListItemIds.value = mergePendingMembership(
      next,
      readingListToggleStates,
    )
  }

  const mergeReadingListPageIds = (nextIds: string[]) => {
    const next = new Set(readingListItemIds.value)
    nextIds.forEach((id) => next.add(id))
    readingListItemIds.value = mergePendingMembership(next, readingListToggleStates)
  }

  const requestReadingListToggle = async (feedItemId: string, fallback: boolean): Promise<boolean | null> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequestResult(`${api.url}/feed/reading-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
      if (res.ok) {
        const data = res.data
        const saved = data.data?.saved ?? data.saved ?? fallback
        return Boolean(saved)
      }
    } catch (e) {
      reportError(e, 'Failed to toggle reading list item')
    }
    return null
  }

  const toggleReadingListItem = async (feedItemId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    readingListMembershipRevision += 1
    return enqueueMembershipToggle(
      readingListToggleStates,
      readingListItemIds,
      feedItemId,
      (fallback) => requestReadingListToggle(feedItemId, fallback),
      sessionGeneration,
    )
  }

  const fetchReadingListIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      readingListItemIds.value = new Set()
      return
    }
    const revision = readingListMembershipRevision
    try {
      const ids = await loadReadingListFeedItemIds(api.url, authStore.token)
      if (revision !== readingListMembershipRevision) return
      readingListItemIds.value = mergePendingMembership(new Set(ids), readingListToggleStates)
    } catch (e) {
      reportError(e, 'Failed to fetch reading list ids')
    }
  }


  const clearMembershipState = () => {
    sessionGeneration += 1
    starMembershipRevision += 1
    readingListMembershipRevision += 1
    for (const state of [...starToggleStates.values(), ...readingListToggleStates.values()]) {
      state.waiters.splice(0).forEach((resolve) => resolve(null))
    }
    starToggleStates.clear()
    readingListToggleStates.clear()
    starredItemIds.value = new Set()
    bookmarkedPostIds.value = new Set()
    readingListItemIds.value = new Set()
  }

  return {
    starredItemIds,
    bookmarkedPostIds,
    readingListItemIds,
    toggleStar,
    fetchStarredIds,
    fetchBookmarkedPostIds,
    togglePostBookmark,
    moveStarToGroup,
    syncStarredPageIds,
    toggleReadingListItem,
    fetchReadingListIds,
    syncReadingListPageIds,
    mergeReadingListPageIds,
    clearMembershipState,
  }
}
