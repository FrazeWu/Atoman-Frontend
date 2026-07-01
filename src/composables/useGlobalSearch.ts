import { computed, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { listMusicAlbums, listMusicArtists } from '@/api/musicV1'
import type { Post } from '@/types'

type ForumSearchResult = {
  id: string
  title: string
  content?: string
  created_at?: string
  user?: {
    username?: string
    display_name?: string
  }
  category?: {
    name?: string
  }
}

export type GlobalSearchItem = {
  id: string
  type: 'forum' | 'blog' | 'music'
  title: string
  subtitle?: string
  meta?: string
  href: string
}

export type GlobalSearchSection = {
  type: 'forum' | 'blog' | 'music'
  label: string
  items: GlobalSearchItem[]
  moreHref: string
}

export type GlobalSearchMode = 'preview' | 'expanded'

function trimText(value?: string, limit = 80) {
  const text = value?.trim() ?? ''
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

export function useGlobalSearch() {
  const api = useApi()
  const query = ref('')
  const loading = ref(false)
  const sections = ref<GlobalSearchSection[]>([])
  const activeIndex = ref(-1)
  let currentRequestId = 0

  const flatItems = computed(() => sections.value.flatMap((section) => section.items))
  const activeItem = computed(() => flatItems.value[activeIndex.value] ?? null)

  const search = async (nextQuery: string, mode: GlobalSearchMode = 'preview') => {
    query.value = nextQuery.trim()
    if (query.value.length < 2) {
      sections.value = []
      activeIndex.value = -1
      return
    }

    const limit = mode === 'expanded' ? '8' : '2'
    const musicLimit = mode === 'expanded' ? 8 : 2

    const requestId = ++currentRequestId
    loading.value = true

    try {
      const [forumRes, blogRes, albumRes, artistRes] = await Promise.all([
        fetch(`${api.url}/forum/search?${new URLSearchParams({ q: query.value, limit })}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }).then((res) => res.json()).catch(() => ({ data: [] })),
        fetch(`${api.blog.posts}?${new URLSearchParams({ q: query.value, limit })}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }).then((res) => res.json()).catch(() => []),
        listMusicAlbums({ q: query.value, page: 1, page_size: musicLimit, sort: 'hot' }).catch(() => ({ data: [], meta: { page: 1, page_size: musicLimit, total: 0, has_more: false } })),
        listMusicArtists({ q: query.value, page: 1, page_size: musicLimit }).catch(() => ({ data: [], meta: { page: 1, page_size: musicLimit, total: 0, has_more: false } })),
      ])

      if (requestId !== currentRequestId) return

      const forumItems: GlobalSearchItem[] = ((forumRes?.data ?? []) as ForumSearchResult[]).slice(0, Number(limit)).map((item) => ({
        id: item.id,
        type: 'forum',
        title: item.title,
        subtitle: trimText(item.content),
        meta: item.category?.name || item.user?.display_name || item.user?.username || '',
        href: `/forum/topic/${item.id}`,
      }))

      const blogItems: GlobalSearchItem[] = ((Array.isArray(blogRes) ? blogRes : blogRes?.data ?? []) as Post[]).slice(0, Number(limit)).map((item) => ({
        id: item.id,
        type: 'blog',
        title: item.title,
        subtitle: trimText(item.summary || item.content),
        meta: item.channel?.name || item.user?.display_name || item.user?.username || '',
        href: `/post/${item.id}`,
      }))

      const musicItems: GlobalSearchItem[] = [
        ...albumRes.data.map((item) => ({
          id: `album-${item.id}`,
          type: 'music' as const,
          title: item.title,
          subtitle: item.artists?.map((artist) => artist.name).join(' / ') || '专辑',
          meta: '专辑',
          href: `/music?album=${item.id}`,
        })),
        ...artistRes.data.map((item) => ({
          id: `artist-${item.id}`,
          type: 'music' as const,
          title: item.name,
          subtitle: trimText(item.bio),
          meta: '艺术家',
          href: `/music?artist=${item.id}`,
        })),
      ].slice(0, musicLimit)

      const nextSections = [
        { type: 'forum' as const, label: '论坛', items: forumItems, moreHref: `/forum/search?q=${encodeURIComponent(query.value)}` },
        { type: 'blog' as const, label: '文章', items: blogItems, moreHref: `/posts?q=${encodeURIComponent(query.value)}` },
        { type: 'music' as const, label: '音乐', items: musicItems, moreHref: `/music?q=${encodeURIComponent(query.value)}` },
      ].filter((section) => section.items.length > 0)
      sections.value = nextSections

      activeIndex.value = flatItems.value.length > 0 ? 0 : -1
    } finally {
      if (requestId === currentRequestId) {
        loading.value = false
      }
    }
  }

  const moveActive = (direction: 1 | -1) => {
    const total = flatItems.value.length
    if (total === 0) {
      activeIndex.value = -1
      return
    }
    if (activeIndex.value < 0) {
      activeIndex.value = 0
      return
    }
    activeIndex.value = (activeIndex.value + direction + total) % total
  }

  const reset = () => {
    query.value = ''
    sections.value = []
    activeIndex.value = -1
    loading.value = false
  }

  return {
    query,
    loading,
    sections,
    activeIndex,
    activeItem,
    flatItems,
    search,
    moveActive,
    reset,
  }
}
