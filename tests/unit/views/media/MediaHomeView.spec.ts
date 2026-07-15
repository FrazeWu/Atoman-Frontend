import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaHomeView from '@/views/media/MediaHomeView.vue'

const fetchMock = vi.fn()
const routerPushMock = vi.fn()
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const batchData = (label: string) => ({
  article: { data: [{ id: `post-${label}`, title: `${label}文章`, created_at: '2026-07-15T10:00:00Z' }] },
  podcast: [{ id: `episode-${label}`, post: { title: `${label}播客` }, created_at: '2026-07-15T09:00:00Z' }],
  video: [{ id: `video-${label}`, title: `${label}视频`, created_at: '2026-07-15T08:00:00Z' }],
})

const batchResponses = (label: string) => {
  const data = batchData(label)
  return [data.article, data.podcast, data.video].map(value => (
    new Response(JSON.stringify(value), { status: 200 })
  ))
}
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
        return new Response(JSON.stringify([
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
        ]), { status: 200 })
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

  it('keeps loading the current home batch when the previous fetch batch returns first', async () => {
    const first = [deferred<Response>(), deferred<Response>(), deferred<Response>()]
    const second = [deferred<Response>(), deferred<Response>(), deferred<Response>()]
    let callIndex = 0
    fetchMock.mockImplementation(() => {
      const index = callIndex++
      return index < 3 ? first[index].promise : second[index - 3].promise
    })
    const wrapper = mount(MediaHomeView, {
      global: { stubs: { RouterLink: RouterLinkStub, FeedArticleSheet: true } },
    })
    await flushPromises()

    const currentLoad = wrapper.vm.$.setupState.loadHome()
    batchResponses('A').forEach((value, index) => first[index].resolve(value))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(wrapper.text()).not.toContain('A文章')
    expect(wrapper.text()).not.toContain('A视频')

    batchResponses('B').forEach((value, index) => second[index].resolve(value))
    await currentLoad
    await flushPromises()
    expect(wrapper.text()).toContain('B文章')
    expect(wrapper.text()).toContain('B播客')
    expect(wrapper.text()).toContain('B视频')
  })

  it('does not let previous delayed JSON overwrite a completed current batch', async () => {
    const firstJson = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()]
    let callIndex = 0
    fetchMock.mockImplementation(() => {
      const index = callIndex++
      if (index < 3) {
        return Promise.resolve({ ok: true, json: () => firstJson[index].promise })
      }
      return Promise.resolve(batchResponses('B')[index - 3])
    })
    const wrapper = mount(MediaHomeView, {
      global: { stubs: { RouterLink: RouterLinkStub, FeedArticleSheet: true } },
    })
    await flushPromises()

    await wrapper.vm.$.setupState.loadHome()
    await flushPromises()
    expect(wrapper.text()).toContain('B文章')
    expect(wrapper.text()).toContain('B视频')

    const firstData = batchData('A')
    ;[firstData.article, firstData.podcast, firstData.video].forEach((value, index) => firstJson[index].resolve(value))
    await flushPromises()

    expect(wrapper.text()).toContain('B文章')
    expect(wrapper.text()).toContain('B视频')
    expect(wrapper.text()).not.toContain('A文章')
    expect(wrapper.text()).not.toContain('A视频')
  })

  it('does not update home state when a batch finishes after unmount', async () => {
    const pending = [deferred<Response>(), deferred<Response>(), deferred<Response>()]
    let callIndex = 0
    fetchMock.mockImplementation(() => pending[callIndex++].promise)
    const wrapper = mount(MediaHomeView, {
      global: { stubs: { RouterLink: RouterLinkStub, FeedArticleSheet: true } },
    })
    await flushPromises()
    const state = wrapper.vm.$.setupState
    const before = {
      posts: [...state.posts],
      episodes: [...state.episodes],
      videos: [...state.videos],
      loading: state.loading,
    }

    wrapper.unmount()
    batchResponses('A').forEach((value, index) => pending[index].resolve(value))
    await flushPromises()

    expect({
      posts: state.posts,
      episodes: state.episodes,
      videos: state.videos,
      loading: state.loading,
    }).toEqual(before)
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
    expect(wrapper.text()).toContain('首页播客单集')
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

  it.each(['network', 'json', 'http'] as const)('keeps successful home sources when podcast has a %s failure', async (failure) => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'post-ok',
            title: '保留的文章',
            created_at: '2026-07-15T10:00:00Z',
            updated_at: '2026-07-15T10:00:00Z',
          }],
        }), { status: 200 })
      }
      if (url.includes('/podcast/episodes')) {
        if (failure === 'network') throw new Error('offline')
        if (failure === 'http') return new Response(JSON.stringify({ error: 'failed' }), { status: 500 })
        return { ok: true, json: async () => { throw new Error('invalid json') } } as Response
      }
      if (url.includes('/videos')) {
        return new Response(JSON.stringify([{
          id: 'video-ok',
          title: '保留的视频',
          created_at: '2026-07-15T09:00:00Z',
          updated_at: '2026-07-15T09:00:00Z',
        }]), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
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
      expect(wrapper.text()).toContain('保留的文章')
      expect(wrapper.text()).toContain('保留的视频')
      expect(wrapper.text()).toContain('暂无播客')
    })
  })
})
