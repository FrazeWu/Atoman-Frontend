import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KanboArticlesView from '@/views/kanbo/KanboArticlesView.vue'
import KanboPodcastsView from '@/views/kanbo/KanboPodcastsView.vue'
import KanboVideosView from '@/views/kanbo/KanboVideosView.vue'

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

vi.mock('@/composables/useKanboChannel', () => ({
  useKanboChannel: () => ({
    currentKanboChannelId: { value: 'channel-should-not-be-used' },
  }),
}))

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: routerPushMock,
    }),
  }
})

describe('Kanbo content view shells', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routerPushMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders functional page titles', () => {
    const global = { stubs: ['RouterLink'] }
    expect(mount(KanboArticlesView, { global }).text()).toContain('文章')
    expect(mount(KanboPodcastsView, { global }).text()).toContain('播客')
    expect(mount(KanboVideosView, { global }).text()).toContain('视频')
  })

  it('treats article podcast and video pages as site-wide explore pages', async () => {
    const global = { stubs: ['RouterLink'] }
    mount(KanboArticlesView, { global })
    mount(KanboPodcastsView, { global })
    mount(KanboVideosView, { global })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(url => url.includes('channel_id=channel-should-not-be-used'))).toBe(false)
    expect(urls.some(url => url.includes('/blog/explore'))).toBe(true)
    expect(urls.some(url => url.includes('/podcast/episodes'))).toBe(true)
    expect(urls.some(url => url.includes('/videos?sort='))).toBe(true)
    expect(mount(KanboArticlesView, { global }).text()).toContain('探索本网站发布的全部文章')
  })

  it('renders videos with VideoCard links to the legacy video module watch route', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{
      id: 'video-1',
      title: '旧详情可达的视频',
      thumbnail_url: '',
      view_count: 12,
      duration_sec: 0,
      created_at: '2026-01-02T00:00:00Z',
    }]), { status: 200 }))

    const wrapper = mount(KanboVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })

    await vi.waitFor(() => {
      expect(wrapper.findComponent({ name: 'VideoCard' }).exists()).toBe(true)
    })
    expect(wrapper.find('a[href="/watch/video-1?site=video"]').exists()).toBe(true)
  })

  it('renders podcast episodes as PaperEntry rows and opens legacy podcast module episode route', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{
      id: 'episode-1',
      duration_sec: 125,
      created_at: '2026-01-02T00:00:00Z',
      post: { title: '旧单集详情可达', summary: '摘要' },
      channel: { name: '节目' },
    }]), { status: 200 }))

    const wrapper = mount(KanboPodcastsView, { global: { stubs: ['RouterLink'] } })

    await vi.waitFor(() => {
      expect(wrapper.find('.paper-entry').exists()).toBe(true)
    })
    await wrapper.find('.paper-entry').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/episode/episode-1?site=podcast')
  })

  it('does not show unsupported popular sorting on articles', () => {
    const wrapper = mount(KanboArticlesView, { global: { stubs: ['RouterLink'] } })

    expect(wrapper.text()).not.toContain('热门')
  })
})
