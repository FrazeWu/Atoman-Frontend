import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedStarredView from '@/views/feed/FeedStarredView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'

const { routeQuery, routerPush, routerReplace } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

describe('FeedStarredView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('treats loaded starred entries as already starred before unstar', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          id: 'feed-item-1',
          feed_source_id: 'source-1',
          guid: 'feed-item-1',
          title: '收藏条目',
          link: 'https://example.com/item',
          summary: '摘要',
          author: '作者',
          published_at: '2026-06-16T00:00:00Z',
          fetched_at: '2026-06-16T00:00:00Z',
        }],
        total: 1,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { starred: false } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }))

    const wrapper = mount(FeedStarredView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: {
            props: ['label'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')">{{ label }}</button>',
          },
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedTimelineFooter: true,
        },
      },
    })

    await flushPromises()
    const feedStore = useFeedStore()
    expect(feedStore.starredItemIds.has('feed-item-1')).toBe(true)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/feed/timeline/star', expect.objectContaining({
      method: 'POST',
    }))
    await vi.waitFor(() => expect(feedStore.starredItemIds.has('feed-item-1')).toBe(false))
  })

  it('plays a podcast from the starred article sheet', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          id: 'feed-item-1',
          feed_source_id: 'source-1',
          guid: 'feed-item-1',
          title: '收藏播客',
          link: 'https://example.com/item',
          summary: '摘要',
          author: '作者',
          source_title: '收藏来源',
          enclosure_url: 'https://cdn.example.com/audio.mp3',
          enclosure_type: 'audio/mpeg',
          published_at: '2026-06-16T00:00:00Z',
          fetched_at: '2026-06-16T00:00:00Z',
        }],
        total: 1,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const wrapper = mount(FeedStarredView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            emits: ['play-podcast', 'close'],
            template: '<button data-test="sheet-play" @click="$emit(\'play-podcast\', { id: \'feed-item-1\', title: \'收藏播客\', enclosure_url: \'https://cdn.example.com/audio.mp3\', published_at: \'2026-06-16T00:00:00Z\', author: \'作者\', feed_source: { title: \'收藏来源\' } })">play</button>',
          },
          FeedTimelineFooter: true,
        },
      },
    })

    await flushPromises()

    const playerStore = usePlayerStore()
    const setQueueSpy = vi.spyOn(playerStore, 'setQueueFromCurrentItems')
    const createPodcastSongSpy = vi.spyOn(playerStore, 'createPodcastSong')
    const playQueuedSongSpy = vi.spyOn(playerStore, 'playQueuedSong').mockImplementation(() => {})

    await wrapper.get('[data-test="sheet-play"]').trigger('click')

    expect(setQueueSpy).toHaveBeenCalled()
    expect(createPodcastSongSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'feed-item-1' }))
    expect(playQueuedSongSpy).toHaveBeenCalled()
  })

  it('returns to the feed module root from the header action', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const wrapper = mount(FeedStarredView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: true,
          PBadge: true,
          PClip: true,
          PPress: {
            props: ['label'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedTimelineFooter: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('header button').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/feed')
  })
})
