import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PortalView from '@/views/portal/PortalView.vue'

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ url: '/api/v1' }),
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

  it('用四张等权卡片展示推荐内容且不在模块区重复', async () => {
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

    expect(wrapper.findAll('.portal-hot__recommendation-card')).toHaveLength(4)
    for (const item of featured) {
      expect(wrapper.text().split(item.title)).toHaveLength(2)
    }

    const recommendationImages = wrapper.findAll('.portal-hot__recommendation-image img')
    expect(recommendationImages[0].attributes('loading')).toBe('eager')
    expect(recommendationImages[0].attributes('fetchpriority')).toBe('high')
    expect(recommendationImages[1].attributes('loading')).toBe('lazy')
    expect(recommendationImages[1].attributes('fetchpriority')).toBe('auto')
  })

  it('推荐内容无图时优先加载模块区第一张图片', async () => {
    const textOnlyFeatured = featured.map((item) => ({ ...item, image_url: '' }))
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured: textOnlyFeatured,
          sections: [
            { module: 'blog', title: '热门文章', items: textOnlyFeatured },
            {
              module: 'music',
              title: '热门音乐',
              items: [{ ...featured[3], id: 'album-2', image_url: 'https://example.com/album-2.jpg' }],
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

    const image = wrapper.get('.portal-hot__thumb img')
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('fetchpriority')).toBe('high')
  })
})
