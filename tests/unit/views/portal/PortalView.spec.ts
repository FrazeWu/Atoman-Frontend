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

const streamItems = [
  {
    id: 'post-stream',
    module: 'blog',
    kind: 'post',
    title: '继续阅读的文章',
    summary: '文章流摘要',
    image_url: '',
    target_path: '/posts/stream',
    score: 6,
    score_label: '热读',
    published_at: '2026-09-02T00:00:00Z',
  },
  {
    id: 'video-stream',
    module: 'video',
    kind: 'video',
    title: '值得观看的视频',
    summary: '视频流摘要',
    image_url: 'https://example.com/video-stream.jpg',
    target_path: '/videos/stream',
    score: 5,
    score_label: '热门',
    published_at: '2026-09-01T00:00:00Z',
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
            { module: 'blog', title: '热门文章', items: [...featured.slice(0, 3), streamItems[0]] },
            { module: 'music', title: '热门音乐', items: featured.slice(3) },
            { module: 'video', title: '热门视频', items: [streamItems[1]] },
          ],
        },
      }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('用一条主推和三条侧列内容展示焦点精选且不在模块区重复', async () => {
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
  })

  it('为主推与侧列内容提供视觉锚点和推荐依据', async () => {
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

    expect(wrapper.findAll('.portal-hot__spotlight-media')).toHaveLength(4)
    expect(wrapper.findAll('[data-test="portal-spotlight-reason"]')).toHaveLength(4)
  })

  it('将未进入焦点精选的内容渲染为单一连续流', async () => {
    const wrapper = mount(PortalView, {
      global: { stubs: { PButton: true, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    await flushPromises()

    const entries = wrapper.findAll('.portal-hot__content-stream-item')
    expect(wrapper.find('.portal-hot__content-stream').exists()).toBe(true)
    expect(entries).toHaveLength(2)
    expect(entries[0].text()).toContain('博客')
    expect(entries[0].text()).toContain('继续阅读的文章')
    expect(entries[0].attributes('href')).toBe('/posts/stream')
    expect(entries[1].text()).toContain('视频')
    expect(entries[1].attributes('href')).toBe('/videos/stream')
    expect(wrapper.find('.portal-hot__sections').exists()).toBe(false)
    expect(wrapper.find('.portal-hot__music-grid').exists()).toBe(false)
    expect(wrapper.find('.portal-hot__video-grid').exists()).toBe(false)
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

  it('点击换一批会请求下一组焦点精选并替换当前卡片', async () => {
    const nextFeatured = featured.map((item, index) => ({
      ...item,
      id: `next-${index + 1}`,
      title: `下一批内容 ${index + 1}`,
      target_path: `/next/${index + 1}`,
    }))
    vi.mocked(fetch).mockImplementation(async (input) => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          featured: String(input).includes('spotlight_offset=4') ? nextFeatured : featured,
          featured_total: 8,
          sections: [],
        },
      }),
    }) as Response)

    const wrapper = mount(PortalView, {
      global: {
        stubs: {
          PButton: {
            props: ['disabled', 'label', 'loading'],
            template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
          },
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-test="portal-refresh-spotlight"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toContain(
      '/api/v1/portal/hot?limit=6&spotlight_offset=4',
    )
    expect(wrapper.text()).toContain('下一批内容 1')
    expect(wrapper.text()).not.toContain('第一篇文章')
  })
})
