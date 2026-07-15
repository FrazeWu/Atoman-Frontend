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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const hotPayload = (id: string, title: string) => ({
  data: {
    featured: [{
      id,
      module: 'blog',
      kind: 'post',
      title,
      summary: '',
      image_url: '',
      target_path: `/posts/${id}`,
      score: 1,
      score_label: '热门',
    }],
    sections: [],
  },
})

const hotResponse = (id: string, title: string) => new Response(JSON.stringify(hotPayload(id, title)), { status: 200 })

const mountPortal = () => mount(PortalView, {
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

type PortalState = {
  loading: boolean
  error: string
  loadHotContent: () => Promise<void>
}

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
    const wrapper = mountPortal()

    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/v1/portal/hot?limit=6', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(wrapper.findAll('.portal-hot__recommendation-card')).toHaveLength(4)
    for (const item of featured) {
      expect(wrapper.text().split(item.title)).toHaveLength(2)
    }
  })

  it('does not let a delayed previous success overwrite current content', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise))
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState

    const currentLoad = state.loadHotContent()
    current.resolve(hotResponse('current', '当前内容'))
    await currentLoad
    previous.resolve(hotResponse('previous', '旧内容'))
    await flushPromises()

    expect(wrapper.text()).toContain('当前内容')
    expect(wrapper.text()).not.toContain('旧内容')
  })

  it('does not let delayed previous JSON overwrite current content', async () => {
    const previousJson = deferred<ReturnType<typeof hotPayload>>()
    const previousJsonReader = vi.fn(() => previousJson.promise)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: previousJsonReader,
      } as Response)
      .mockResolvedValueOnce(hotResponse('current', '当前内容')))
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState
    await vi.waitFor(() => expect(previousJsonReader).toHaveBeenCalledTimes(1))

    await state.loadHotContent()
    previousJson.resolve(hotPayload('previous', '旧内容'))
    await flushPromises()

    expect(wrapper.text()).toContain('当前内容')
    expect(wrapper.text()).not.toContain('旧内容')
  })

  it('does not let a delayed previous failure replace current content', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise))
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState

    const currentLoad = state.loadHotContent()
    current.resolve(hotResponse('current', '当前内容'))
    await currentLoad
    previous.reject(new Error('old request failed'))
    await flushPromises()

    expect(state.error).toBe('')
    expect(wrapper.text()).toContain('当前内容')
  })

  it('keeps loading current content when the previous request finishes first', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise))
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState

    const currentLoad = state.loadHotContent()
    previous.resolve(hotResponse('previous', '旧内容'))
    await flushPromises()

    expect(state.loading).toBe(true)

    current.resolve(hotResponse('current', '当前内容'))
    await currentLoad
  })

  it('clears content without an error when the current request returns 404', async () => {
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState
    await flushPromises()
    expect(wrapper.text()).toContain('第一篇文章')

    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }))
    await state.loadHotContent()

    expect(state.error).toBe('')
    expect(state.loading).toBe(false)
    expect(wrapper.text()).not.toContain('第一篇文章')
    expect(wrapper.text()).toContain('还没有可展示的热门内容')
  })

  it('shows an error and settles loading for a current non-2xx response', async () => {
    const wrapper = mountPortal()
    const state = wrapper.vm.$.setupState as PortalState
    await flushPromises()

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: { featured: featured.slice(0, 1), sections: [] },
    }), { status: 500 }))
    await state.loadHotContent()

    expect(state.error).toBe('服务端返回异常')
    expect(state.loading).toBe(false)
    expect(wrapper.text()).toContain('热门内容暂时没有加载出来')
  })
})
