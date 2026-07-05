import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import MediaBookmarksView from '@/views/media/MediaBookmarksView.vue'
import MediaSubscriptionsView from '@/views/media/MediaSubscriptionsView.vue'
import { useAuthStore } from '@/stores/auth'

const fetchMock = vi.fn()
const routerPushMock = vi.fn()
const RouterLinkStub = defineComponent({
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => h('a', { href: String(props.to) }, slots.default?.())
  },
})

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: routerPushMock,
    }),
  }
})

const timelinePayload = {
  data: [
    {
      type: 'post',
      post: {
        id: 'post-article-1',
        user_id: 'user-1',
        title: '站内文章',
        content: '文章正文',
        summary: '文章摘要',
        status: 'published',
        visibility: 'public',
        allow_comments: true,
        pinned: false,
        created_at: '2026-06-30T08:00:00Z',
        updated_at: '2026-06-30T08:00:00Z',
      },
      published_at: '2026-06-30T08:00:00Z',
      is_read: false,
    },
    {
      type: 'post',
      post: {
        id: 'post-podcast-1',
        user_id: 'user-1',
        title: '站内播客',
        content: '播客正文',
        summary: '播客摘要',
        status: 'published',
        visibility: 'public',
        allow_comments: true,
        pinned: false,
        created_at: '2026-06-29T08:00:00Z',
        updated_at: '2026-06-29T08:00:00Z',
        collections: [{ id: 'collection-podcast', channel_id: 'channel-1', name: '播客', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z' }],
      },
      published_at: '2026-06-29T08:00:00Z',
      is_read: false,
    },
    {
      type: 'feed_item',
      feed_item: {
        id: 'external-video-1',
        feed_source_id: 'source-1',
        feed_source: { id: 'source-1', title: '外部视频源' },
        guid: 'external-video-1',
        title: '外部视频',
        link: 'https://example.com/video',
        summary: '不应展示',
        author: '外部作者',
        published_at: '2026-06-28T08:00:00Z',
        fetched_at: '2026-06-28T08:00:00Z',
        enclosure_type: 'video/mp4',
      },
      published_at: '2026-06-28T08:00:00Z',
      is_read: false,
    },
  ],
  meta: { page: 1, page_size: 20, total: 3, has_more: false },
}

const bookmarkPayloads = {
  article: {
    data: [{
      id: 'bookmark-post-1',
      post_id: 'post-article-1',
      post: {
        id: 'post-article-1',
        user_id: 'user-1',
        title: '文章收藏',
        content: '文章正文',
        summary: '文章摘要',
        status: 'published',
        visibility: 'public',
        allow_comments: true,
        pinned: false,
        created_at: '2026-06-30T08:00:00Z',
        updated_at: '2026-06-30T08:00:00Z',
      },
    }],
  },
  video: {
    data: [{
      id: 'bookmark-video-1',
      video_id: 'video-1',
      video: {
        id: 'video-1',
        channel_id: 'channel-video-1',
        user_id: 'user-1',
        title: '视频收藏',
        description: '视频简介',
        storage_type: 'external',
        video_url: 'https://example.com/video',
        thumbnail_url: '',
        duration_sec: 120,
        visibility: 'public',
        status: 'published',
        view_count: 18,
        tags: [],
        created_at: '2026-06-29T08:00:00Z',
        updated_at: '2026-06-29T08:00:00Z',
      },
    }],
  },
  podcast: {
    data: [{
      id: 'bookmark-episode-1',
      episode_id: 'episode-1',
      episode: {
        id: 'episode-1',
        post_id: 'post-podcast-1',
        channel_id: 'channel-podcast-1',
        audio_url: 'https://example.com/audio.mp3',
        duration_sec: 245,
        episode_cover_url: '',
        season_number: 1,
        episode_number: 2,
        created_at: '2026-06-28T08:00:00Z',
        updated_at: '2026-06-28T08:00:00Z',
        post: {
          id: 'post-podcast-1',
          user_id: 'user-1',
          title: '播客收藏',
          content: '播客正文',
          summary: '播客摘要',
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          pinned: false,
          created_at: '2026-06-28T08:00:00Z',
          updated_at: '2026-06-28T08:00:00Z',
        },
        channel: {
          id: 'channel-podcast-1',
          user_id: 'user-1',
          name: '节目一',
          slug: 'show-one',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        },
      },
    }],
  },
  videoChannel: {
    data: [{
      id: 'bookmark-video-channel-1',
      channel_id: 'channel-video-1',
      kind: 'video_channel',
      channel: {
        id: 'channel-video-1',
        user_id: 'user-1',
        name: '视频频道',
        slug: 'video-channel',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    }],
  },
  podcastShow: {
    data: [{
      id: 'bookmark-podcast-show-1',
      channel_id: 'channel-podcast-1',
      kind: 'podcast_show',
      channel: {
        id: 'channel-podcast-1',
        user_id: 'user-1',
        name: '播客节目',
        slug: 'podcast-show',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    }],
  },
}

describe('Media global views', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routerPushMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/feed/timeline')) {
        return new Response(JSON.stringify(timelinePayload), { status: 200 })
      }
      if (url.endsWith('/blog/bookmarks')) {
        return new Response(JSON.stringify(bookmarkPayloads.article), { status: 200 })
      }
      if (url.endsWith('/videos/bookmarks')) {
        return new Response(JSON.stringify(bookmarkPayloads.video), { status: 200 })
      }
      if (url.endsWith('/podcast/bookmarks')) {
        return new Response(JSON.stringify(bookmarkPayloads.podcast), { status: 200 })
      }
      if (url.endsWith('/videos/channel-bookmarks')) {
        return new Response(JSON.stringify(bookmarkPayloads.videoChannel), { status: 200 })
      }
      if (url.endsWith('/podcast/show-bookmarks')) {
        return new Response(JSON.stringify(bookmarkPayloads.podcastShow), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('marks subscriptions and bookmarks as global pages', () => {
    expect(mount(MediaSubscriptionsView).text()).toContain('订阅')
    expect(mount(MediaBookmarksView).text()).toContain('收藏')
  })

  it('only keeps internal subscription content and filters out external feed items', async () => {
    const wrapper = mount(MediaSubscriptionsView)

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer token',
      }),
    }))
    expect(wrapper.text()).toContain('站内文章')
    expect(wrapper.text()).toContain('站内播客')
    expect(wrapper.text()).not.toContain('外部视频')
    expect(wrapper.text()).not.toContain('外部视频源')
  })

  it('supports all article podcast video filters and shows empty results for missing real data', async () => {
    const wrapper = mount(MediaSubscriptionsView)

    await flushPromises()

    const segments = wrapper.findAll('.p-segmented-control-item')
    expect(segments.map((item) => item.text())).toEqual(expect.arrayContaining(['全部', '文章', '播客', '视频']))

    await segments.find((item) => item.text() === '文章')!.trigger('click')
    expect(wrapper.text()).toContain('站内文章')
    expect(wrapper.text()).not.toContain('站内播客')

    await segments.find((item) => item.text() === '播客')!.trigger('click')
    expect(wrapper.text()).toContain('站内播客')
    expect(wrapper.text()).not.toContain('站内文章')

    await segments.find((item) => item.text() === '视频')!.trigger('click')
    expect(wrapper.text()).toContain('暂无视频')
    expect(wrapper.text()).not.toContain('外部视频')
  })

  it('loads content and container bookmarks through real media bookmark sources', async () => {
    const wrapper = mount(MediaBookmarksView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    await flushPromises()

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toContain('/api/v1/blog/bookmarks')
    expect(urls).toContain('/api/v1/videos/bookmarks')
    expect(urls).toContain('/api/v1/podcast/bookmarks')
    expect(urls).toContain('/api/v1/videos/channel-bookmarks')
    expect(urls).toContain('/api/v1/podcast/show-bookmarks')

    expect(wrapper.text()).toContain('播客')
    expect(wrapper.text()).toContain('容器')
    expect(wrapper.text()).toContain('文章收藏')
    expect(wrapper.text()).toContain('视频收藏')
    expect(wrapper.text()).toContain('播客收藏')
  })

  it('sends auth headers for every bookmark source request', async () => {
    mount(MediaBookmarksView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    await flushPromises()

    const bookmarkCalls = fetchMock.mock.calls.filter((call) => {
      const url = String(call[0])
      return [
        '/api/v1/blog/bookmarks',
        '/api/v1/videos/bookmarks',
        '/api/v1/podcast/bookmarks',
        '/api/v1/videos/channel-bookmarks',
        '/api/v1/podcast/show-bookmarks',
      ].includes(url)
    })

    expect(bookmarkCalls).toHaveLength(5)
    for (const call of bookmarkCalls) {
      expect(call[1]).toEqual(expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }))
    }
  })
})
