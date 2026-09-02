import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PortalView from '@/views/portal/PortalView.vue'
import { useAuthStore } from '@/stores/auth'

const { routerReplace } = vi.hoisted(() => ({ routerReplace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplace }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ url: '/api/v1' }),
  useApiUrl: () => '/api/v1',
}))

vi.mock('@/stores/siteAccess', () => ({
  useSiteAccessStore: () => ({
    isModuleVisible: () => true,
  }),
}))

const featured = [
  {
    id: 'post-1',
    module: 'blog',
    kind: 'post',
    title: '第一篇文章',
    summary: '文章摘要',
    image_url: 'https://example.com/post-1.jpg',
    target_path: '/posts/1',
    score: 10,
    score_label: '热门',
  },
  {
    id: 'post-2',
    module: 'blog',
    kind: 'post',
    title: '第二篇文章',
    summary: '文章摘要',
    image_url: '',
    target_path: '/posts/2',
    score: 9,
    score_label: '热门',
  },
  {
    id: 'post-3',
    module: 'blog',
    kind: 'post',
    title: '第三篇文章',
    summary: '文章摘要',
    image_url: '',
    target_path: '/posts/3',
    score: 8,
    score_label: '热门',
  },
  {
    id: 'album-1',
    module: 'music',
    kind: 'album',
    title: '一张专辑',
    summary: '专辑摘要',
    image_url: 'https://example.com/album-1.jpg',
    target_path: '/albums/1',
    score: 7,
    score_label: '热门',
  },
]

describe('PortalView', () => {
  beforeEach(() => {
    routerReplace.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured,
          sections: [
            { module: 'blog', title: '热门文章', items: featured.slice(0, 3) },
            { module: 'music', title: '热门音乐', items: featured.slice(3) },
          ],
        },
      }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('用一条主推和三条侧列展示焦点精选，且不在模块区重复', async () => {
    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.findAll('.portal-hot__spotlight-lead')).toHaveLength(1)
    expect(wrapper.findAll('.portal-hot__spotlight-rail-item')).toHaveLength(3)
    for (const item of featured) {
      expect(wrapper.text().split(item.title)).toHaveLength(2)
    }

    const leadImage = wrapper.get('.portal-hot__spotlight-lead img')
    expect(leadImage.attributes('loading')).toBe('eager')
    expect(leadImage.attributes('fetchpriority')).toBe('high')
    expect(wrapper.find('.portal-hot__hero-actions').exists()).toBe(false)
    expect(wrapper.find('[data-test="portal-refresh-spotlight"]').exists()).toBe(false)
  })

  it('复用内容卡片为焦点精选提供视觉锚点和推荐依据', async () => {
    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.findAll('.portal-hot__spotlight-card')).toHaveLength(4)
    expect(wrapper.findAll('[data-test="portal-spotlight-reason"]')).toHaveLength(4)
  })

  it('使用后端返回的艺人和真实统计渲染热门音乐', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured,
          sections: [
            {
              module: 'music',
              title: '热门音乐',
              items: [{
                ...featured[3],
                id: 'album-backend-metadata',
                title: '后端专辑',
                summary: '不应作为艺人名称使用',
                artists: [{ id: 'artist-1', name: '真实艺人' }],
                play_count: 321,
                bookmark_count: 12,
                published_at: '2024-06-01T00:00:00Z',
              }],
            },
          ],
        },
      }),
    } as Response)

    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
    await flushPromises()

    const card = wrapper.get('.portal-hot__music-grid .music-album-card')
    expect(card.get('.artist-link').text()).toBe('真实艺人')
    expect(card.get('.artist-link').attributes('href')).toBe('/music/artist/artist-1')
    expect(card.findAll('.stat-val').map((stat) => stat.text())).toEqual(['321', '12'])
    expect(card.get('.music-summary').text()).toContain('2024')
  })

  it('作者头像缺失时使用频道封面', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured,
          sections: [
            {
              module: 'blog',
              title: '热门文章',
              items: [{
                ...featured[0],
                id: 'blog-channel-fallback',
                author_name: '频道作者',
                author_username: 'channel-owner',
                author_avatar_url: '',
                source_image_url: 'https://example.com/channel-owner.png',
              }],
            },
          ],
        },
      }),
    } as Response)

    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('img[alt="频道作者 的头像"]').attributes('src')).toContain('/channel-owner.png')
  })

  it('在博客与订阅模块区展示作者和来源头像', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured,
          sections: [
            {
              module: 'blog',
              title: '热门文章',
              items: [{
                ...featured[0],
                id: 'blog-with-author',
                author_name: '门户作者',
                author_username: 'portal-author',
                author_avatar_url: 'https://example.com/portal-author.png',
              }],
            },
            {
              module: 'feed',
              title: '订阅热读',
              items: [{
                ...featured[1],
                id: 'feed-with-source',
                module: 'feed',
                source_name: '技术周刊',
                source_image_url: 'https://example.com/weekly.png',
              }],
            },
          ],
        },
      }),
    } as Response)

    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('img[alt="门户作者 的头像"]').attributes('src')).toContain('/portal-author.png')
    expect(wrapper.get('img[alt="技术周刊 的网站图标"]').attributes('src')).toContain('/weekly.png')
  })

  it('模块按首页顺序展示，标题简化为模块名并限制四条内容', async () => {
    const blogItems = Array.from({ length: 6 }, (_, index) => ({
      ...featured[0],
      id: `blog-${index + 1}`,
      title: `文章 ${index + 1}`,
      target_path: `/posts/${index + 1}`,
    }))
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured: [],
          sections: [
            { module: 'music', title: '热门音乐', items: featured.slice(3) },
            { module: 'blog', title: '热门文章', items: blogItems },
          ],
        },
      }),
    } as Response)

    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: true,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.findAll('.portal-hot__card-link')).toHaveLength(4)
    expect(wrapper.findAll('.portal-hot__section-head h2').map((heading) => heading.text())).toEqual(['博客', '音乐'])
  })

  it('登录用户访问首页时不跳转到订阅页', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore(pinia).isAuthenticated = true

    mount(PortalView, {
      global: {
        plugins: [pinia],
        stubs: { PButton: true, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(routerReplace).not.toHaveBeenCalled()
  })

})
