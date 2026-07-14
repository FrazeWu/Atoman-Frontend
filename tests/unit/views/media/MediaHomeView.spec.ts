import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaHomeView from '@/views/media/MediaHomeView.vue'

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

describe('MediaHomeView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routerPushMock.mockReset()
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts')) {
        return new Response(JSON.stringify({
          data: [
            {
                id: 'post-1',
                title: '首页主文章',
                summary: '文章摘要',
                cover_url: '/article-cover.jpg',
                created_at: '2026-06-22T10:00:00Z',
                updated_at: '2026-06-22T10:00:00Z',
                channel: { name: '专栏甲' },
                user: { username: 'writer-a', display_name: '作者甲' },
            },
            {
                id: 'post-2',
                title: '第二篇文章',
                summary: '第二篇摘要',
                created_at: '2026-06-22T07:00:00Z',
                updated_at: '2026-06-22T07:00:00Z',
                channel: { name: '专栏乙' },
                user: { username: 'writer-b', display_name: '作者乙' },
            },
          ],
        }), { status: 200 })
      }

      if (url.includes('/podcast/episodes')) {
        return new Response(JSON.stringify({
          episodes: [
            {
              id: 'episode-1',
              duration_sec: 185,
              created_at: '2026-06-22T09:00:00Z',
              updated_at: '2026-06-22T09:00:00Z',
              post: { title: '首页播客单集', summary: '播客摘要' },
              channel: { name: '播客节目' },
            },
            {
              id: 'episode-2',
              duration_sec: 240,
              created_at: '2026-06-22T06:00:00Z',
              updated_at: '2026-06-22T06:00:00Z',
              post: { title: '第二个播客', summary: '第二个播客摘要' },
              channel: { name: '播客节目 2' },
            },
          ],
        }), { status: 200 })
      }

      if (url.includes('/videos')) {
        return new Response(JSON.stringify([
          {
            id: 'video-1',
            title: '首页视频',
            thumbnail_url: '/video-cover.jpg',
            created_at: '2026-06-22T08:00:00Z',
            updated_at: '2026-06-22T08:00:00Z',
          },
          {
            id: 'video-2',
            title: '第二个视频',
            thumbnail_url: '/video-cover-2.jpg',
            created_at: '2026-06-22T05:00:00Z',
            updated_at: '2026-06-22T05:00:00Z',
          },
        ]), { status: 200 })
      }

      return new Response('[]', { status: 200 })
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders a featured hero band plus article podcast and video sections', async () => {
    const wrapper = mount(MediaHomeView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article'],
            template: '<aside data-testid="home-article-sheet" :data-show="String(show)" :data-article-id="article?.post?.id || \'\'"></aside>',
          },
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="content-home-feature-0"]').exists()).toBe(true)
    })

    expect(wrapper.get('[data-testid="content-home-hero"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content-home-feature-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content-home-feature-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content-home-feature-2"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('文章')
    expect(wrapper.text()).toContain('播客')
    expect(wrapper.text()).toContain('视频')
    expect(wrapper.text()).toContain('进入创作')
    expect(wrapper.find('a[href="/media/articles"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/media/podcasts"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/media/videos"]').exists()).toBe(true)
  })

  it('opens featured or listed article items in the right sheet instead of leaving the homepage', async () => {
    const wrapper = mount(MediaHomeView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article'],
            template: '<aside data-testid="home-article-sheet" :data-show="String(show)" :data-article-id="article?.post?.id || \'\'"></aside>',
          },
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="content-home-feature-0"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="content-home-feature-0"]').trigger('click')
    expect(wrapper.get('[data-testid="home-article-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-testid="home-article-sheet"]').attributes('data-article-id')).toBe('post-1')
  })

  it('navigates featured podcast and video cards to their detail routes', async () => {
    const wrapper = mount(MediaHomeView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article'],
            template: '<aside data-testid="home-article-sheet" :data-show="String(show)" :data-article-id="article?.post?.id || \'\'"></aside>',
          },
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="content-home-feature-2"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="content-home-feature-1"]').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/media/podcasts/episode/episode-1')

    await wrapper.get('[data-testid="content-home-feature-2"]').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/media/videos/watch/video-1')
  })

  it('treats a null article payload as an empty list', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts')) {
        return new Response(JSON.stringify({ data: null, message: 'ok' }), { status: 200 })
      }
      return new Response('[]', { status: 200 })
    })

    const wrapper = mount(MediaHomeView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          FeedArticleSheet: true,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('暂无文章')
      expect(wrapper.text()).toContain('暂无播客')
      expect(wrapper.text()).toContain('暂无视频')
    })
  })
})
