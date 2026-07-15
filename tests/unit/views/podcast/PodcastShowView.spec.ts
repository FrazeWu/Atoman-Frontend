import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import PodcastShowView from '@/views/podcast/PodcastShowView.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const showResponse = (slug: string, name: string, episodeTitle: string) => ({
  channel: {
    id: `channel-${slug}`,
    slug,
    name,
    description: `${name}简介`,
    cover_url: `https://example.com/${slug}.jpg`,
  },
  episodes: [{
    id: `episode-${slug}`,
    post_id: `post-${slug}`,
    channel_id: `channel-${slug}`,
    post: { id: `post-${slug}`, title: episodeTitle },
    audio_url: `https://example.com/${slug}.mp3`,
    episode_number: 1,
    season_number: 1,
    duration_sec: 120,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  }],
})

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/podcasts/show/:channelSlug', component: PodcastShowView }],
})

const makeOptionalRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/podcasts/show/:channelSlug?', component: PodcastShowView }],
})

const mountShow = (router: ReturnType<typeof makeRouter>) => mount(PodcastShowView, {
  global: {
    plugins: [router],
    stubs: { RouterLink: { template: '<a><slot /></a>' } },
  },
})

describe('PodcastShowView', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['array', ['show-a']],
  ])('does not request an invalid initial show slug: %s', async (_label, rawSlug) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = makeOptionalRouter()
    await router.push('/podcasts/show')
    ;(router.currentRoute.value.params as Record<string, unknown>).channelSlug = rawSlug
    const wrapper = mountShow(router)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.channel).toBeNull()
    expect(wrapper.vm.$.setupState.episodes).toEqual([])
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.text()).toContain('节目不存在')
  })

  it('invalidates a pending show request when the slug becomes invalid', async () => {
    const first = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => first.promise))
    const router = makeOptionalRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()

    await router.push('/podcasts/show')
    await flushPromises()
    expect(wrapper.vm.$.setupState.channel).toBeNull()
    expect(wrapper.vm.$.setupState.episodes).toEqual([])
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.text()).toContain('节目不存在')

    first.resolve(response(showResponse('show-a', '过期节目', '过期单集')))
    await flushPromises()
    expect(wrapper.text()).not.toContain('过期节目')
    expect(wrapper.text()).toContain('节目不存在')
  })

  it('does not update state when a response arrives after unmount', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const router = makeRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()
    const state = wrapper.vm.$.setupState
    const before = {
      channel: state.channel,
      episodes: [...state.episodes],
      error: state.error,
      loading: state.loading,
    }

    wrapper.unmount()
    pending.resolve(response(showResponse('show-a', '卸载后节目', '卸载后单集')))
    await flushPromises()

    expect({
      channel: state.channel,
      episodes: state.episodes,
      error: state.error,
      loading: state.loading,
    }).toEqual(before)
  })

  it('loads a reused show slug and ignores the previous response', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const fetchMock = vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/shows/show-a/episodes') ? first.promise : second.promise
    ))
    vi.stubGlobal('fetch', fetchMock)
    const router = makeRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()

    await router.push('/podcasts/show/show-b')
    await flushPromises()
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/podcast/shows/show-b/episodes'))).toBe(true)

    second.resolve(response(showResponse('show-b', '当前节目', '当前单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前节目')
    expect(wrapper.text()).toContain('当前单集')

    first.resolve(response(showResponse('show-a', '过期节目', '过期单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前节目')
    expect(wrapper.text()).not.toContain('过期节目')
  })

  it('keeps loading the current show when the previous response arrives first', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/shows/show-a/episodes') ? first.promise : second.promise
    )))
    const router = makeRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()

    await router.push('/podcasts/show/show-b')
    first.resolve(response(showResponse('show-a', '过期节目', '过期单集')))
    await flushPromises()

    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.text()).not.toContain('过期节目')

    second.resolve(response(showResponse('show-b', '当前节目', '当前单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前节目')
  })

  it('clears the previous show when the reused route returns non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/shows/show-a/episodes')
        ? Promise.resolve(response(showResponse('show-a', '原节目', '原单集')))
        : Promise.resolve(response({ error: 'show not found' }, 404))
    )))
    const router = makeRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()
    expect(wrapper.text()).toContain('原节目')

    await router.push('/podcasts/show/show-b')
    await flushPromises()
    expect(wrapper.text()).toContain('节目不存在')
    expect(wrapper.text()).not.toContain('原节目')
  })

  it('clears the previous show and reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/shows/show-a/episodes')
        ? Promise.resolve(response(showResponse('show-a', '原节目', '原单集')))
        : Promise.reject(new Error('offline'))
    )))
    const router = makeRouter()
    await router.push('/podcasts/show/show-a')
    const wrapper = mountShow(router)
    await flushPromises()

    await router.push('/podcasts/show/show-b')
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.text()).not.toContain('原节目')
  })
})
