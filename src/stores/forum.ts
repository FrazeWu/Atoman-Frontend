import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ForumCategory, ForumTopic, ForumDraft, ForumFollow, ForumFollowTargetType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

const api = useApi()

const DRAFT_KEY_PREFIX = 'forum_draft_'

export const useForumStore = defineStore('forum', () => {
  const categories = ref<ForumCategory[]>([])
  const categoriesLoaded = ref(false)
  const topics = ref<ForumTopic[]>([])
  const topicsTotal = ref(0)
  const currentTopic = ref<ForumTopic | null>(null)
  const searchResults = ref<ForumTopic[]>([])
  const searchTotal = ref(0)
  const follows = ref<ForumFollow[]>([])
  const followsOwnerID = ref<string | null>(null)
  let followsGeneration = 0
  const loading = ref(false)
  const error = ref<string | null>(null)

  const authHeaders = () => {
    const authStore = useAuthStore()
    return { Authorization: `Bearer ${authStore.token}` }
  }

  // ─── Categories ──────────────────────────────────────────────────────────────

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${api.url}/forum/categories`)
      if (res.ok) {
        const data = await res.json()
        categories.value = data.data || []
      }
    } catch (e) {
      console.error('Failed to fetch forum categories', e)
    } finally {
      categoriesLoaded.value = true
    }
  }

  // ─── Topics ──────────────────────────────────────────────────────────────────

  const fetchTopics = async (params: {
    categoryId?: string
    sort?: 'latest' | 'top' | 'active' | 'featured'
    tag?: string
    search?: string
    page?: number
    limit?: number
  } = {}) => {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams()
      if (params.categoryId) query.set('category_id', params.categoryId)
      if (params.sort) query.set('sort', params.sort)
      if (params.tag) query.set('tag', params.tag)
      if (params.search) query.set('search', params.search)
      if (params.page) query.set('page', String(params.page))
      if (params.limit) query.set('page_size', String(params.limit))
      const authStore = useAuthStore()
      const res = await fetch(`${api.url}/forum/topics?${query}`, {
        headers: authStore.isAuthenticated ? authHeaders() : {},
      })
      if (res.ok) {
        const data = await res.json()
        topics.value = data.data || []
        topicsTotal.value = data.meta?.total || 0
      }
    } catch (e) {
      error.value = 'Failed to fetch topics'
    } finally {
      loading.value = false
    }
  }

  const fetchTopic = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const res = await fetch(`${api.url}/forum/topics/${id}`, {
        headers: authStore.isAuthenticated ? authHeaders() : {},
      })
      if (res.ok) {
        const data = await res.json()
        currentTopic.value = data.data
      } else {
        error.value = 'Topic not found'
      }
    } catch (e) {
      error.value = 'Failed to fetch topic'
    } finally {
      loading.value = false
    }
  }

  const createTopic = async (payload: {
    category_id: string
    title: string
    content: string
    tags?: string[]
  }): Promise<ForumTopic | null> => {
    try {
      const res = await fetch(`${api.url}/forum/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...payload, tags: payload.tags ?? [] }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.data as ForumTopic
      }
    } catch (e) {
      console.error('Failed to create topic', e)
    }
    return null
  }

  const updateTopic = async (id: string, payload: {
    title?: string
    content?: string
    tags?: string[]
  }): Promise<boolean> => {
    try {
      const res = await fetch(`${api.url}/forum/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      return res.ok
    } catch (e) {
      console.error('Failed to update topic', e)
      return false
    }
  }

  const deleteTopic = async (id: string) => {
    try {
      const res = await fetch(`${api.url}/forum/topics/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        topics.value = topics.value.filter((t) => t.id !== id)
      }
    } catch (e) {
      console.error('Failed to delete topic', e)
    }
  }

  const toggleTopicLike = async (id: string) => {
    try {
      const res = await fetch(`${api.url}/forum/topics/${id}/like`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        const liked = data.data?.liked as boolean
        const update = (t: ForumTopic) => {
          if (t.id === id) {
            t.is_liked = liked
            t.like_count += liked ? 1 : -1
          }
        }
        topics.value.forEach(update)
        if (currentTopic.value?.id === id) update(currentTopic.value)
      }
    } catch (e) {
      console.error('Failed to toggle like', e)
    }
  }

  const toggleTopicBookmark = async (id: string) => {
    try {
      const res = await fetch(`${api.url}/forum/topics/${id}/bookmark`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        const bookmarked = data.data?.bookmarked as boolean
        const update = (t: ForumTopic) => {
          if (t.id === id) t.is_bookmarked = bookmarked
        }
        topics.value.forEach(update)
        if (currentTopic.value?.id === id) update(currentTopic.value)
      }
    } catch (e) {
      console.error('Failed to toggle bookmark', e)
    }
  }

  // ─── Follows ────────────────────────────────────────────────────────────────

  const currentFollowOwnerID = () => {
    const authStore = useAuthStore()
    return authStore.isAuthenticated && authStore.user?.uuid ? authStore.user.uuid : null
  }

  const ensureFollowOwner = () => {
    const ownerID = currentFollowOwnerID()
    if (followsOwnerID.value !== ownerID) {
      followsOwnerID.value = ownerID
      follows.value = []
      followsGeneration++
    }
    return ownerID
  }

  const fetchFollows = async () => {
    const ownerID = ensureFollowOwner()
    if (!ownerID) return
    const generation = ++followsGeneration
    try {
      const res = await fetch(`${api.url}/forum/follows`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        if (ensureFollowOwner() !== ownerID || followsGeneration !== generation) return
        follows.value = data.data || []
      }
    } catch (e) {
      ensureFollowOwner()
      console.error('Failed to fetch follows', e)
    }
  }

  const isFollowing = (targetType: ForumFollowTargetType, targetKey: string) => {
    if (!ensureFollowOwner()) return false
    return follows.value.some((follow) => follow.target_type === targetType && follow.target_key === targetKey)
  }

  const followTargetUrl = (targetType: ForumFollowTargetType, targetKey: string) => {
    const query = new URLSearchParams({ target_key: targetKey })
    return `${api.url}/forum/follows/${targetType}?${query}`
  }

  const follow = async (targetType: ForumFollowTargetType, targetKey: string) => {
    const ownerID = ensureFollowOwner()
    if (!ownerID) return
    const res = await fetch(followTargetUrl(targetType, targetKey), {
      method: 'PUT',
      headers: authHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      if (ensureFollowOwner() !== ownerID) return
      followsGeneration++
      const created = data.data as ForumFollow
      follows.value = follows.value.filter((item) => item.target_type !== targetType || item.target_key !== targetKey)
      follows.value.push(created)
    }
  }

  const unfollow = async (targetType: ForumFollowTargetType, targetKey: string) => {
    const ownerID = ensureFollowOwner()
    if (!ownerID) return
    const res = await fetch(followTargetUrl(targetType, targetKey), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      if (ensureFollowOwner() !== ownerID) return
      followsGeneration++
      follows.value = follows.value.filter((item) => item.target_type !== targetType || item.target_key !== targetKey)
    }
  }

  const toggleFollow = async (targetType: ForumFollowTargetType, targetKey: string) => {
    if (isFollowing(targetType, targetKey)) {
      await unfollow(targetType, targetKey)
    } else {
      await follow(targetType, targetKey)
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  const searchTopics = async (q: string, page = 1, limit = 20) => {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const query = new URLSearchParams({ q, page: String(page), page_size: String(limit) })
      const res = await fetch(`${api.url}/forum/search?${query}`, {
        headers: authStore.isAuthenticated ? authHeaders() : {},
      })
      if (res.ok) {
        const data = await res.json()
        const results = data.data || []
        searchResults.value = page === 1 ? results : [...searchResults.value, ...results]
        searchTotal.value = data.meta?.total || 0
      }
    } catch (e) {
      error.value = 'Search failed'
    } finally {
      loading.value = false
    }
  }

  // ─── Drafts (localStorage + optional backend) ────────────────────────────────

  const saveDraftLocal = (key: string, draft: Partial<ForumDraft>) => {
    try {
      localStorage.setItem(DRAFT_KEY_PREFIX + key, JSON.stringify({ ...draft, saved_at: Date.now() }))
    } catch (e) {
      // storage quota exceeded — silently ignore
    }
  }

  const loadDraftLocal = (key: string): Partial<ForumDraft> | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY_PREFIX + key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  const clearDraftLocal = (key: string) => {
    localStorage.removeItem(DRAFT_KEY_PREFIX + key)
  }

  // Backend draft API (cross-device persistence)
  const fetchDraft = async (contextKey: string): Promise<ForumDraft | null> => {
    try {
      const res = await fetch(`${api.url}/forum/drafts?context_key=${encodeURIComponent(contextKey)}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        return data.data as ForumDraft
      }
    } catch (e) {
      console.error('Failed to fetch draft', e)
    }
    return null
  }

  const putDraft = async (draft: ForumDraft): Promise<boolean> => {
    try {
      const res = await fetch(`${api.url}/forum/drafts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(draft),
      })
      return res.ok
    } catch (e) {
      console.error('Failed to save draft', e)
      return false
    }
  }

  const deleteDraft = async (contextKey: string): Promise<void> => {
    try {
      await fetch(`${api.url}/forum/drafts?context_key=${encodeURIComponent(contextKey)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
    } catch (e) {
      console.error('Failed to delete draft', e)
    }
    clearDraftLocal(contextKey)
  }

  return {
    categories,
    categoriesLoaded,
    topics,
    topicsTotal,
    currentTopic,
    searchResults,
    searchTotal,
    follows,
    loading,
    error,
    fetchCategories,
    fetchTopics,
    fetchTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    toggleTopicLike,
    toggleTopicBookmark,
    fetchFollows,
    isFollowing,
    follow,
    unfollow,
    toggleFollow,
    searchTopics,
    saveDraftLocal,
    loadDraftLocal,
    clearDraftLocal,
    fetchDraft,
    putDraft,
    deleteDraft,
  }
})
