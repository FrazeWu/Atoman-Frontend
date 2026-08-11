import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { moduleRoutes } from '@/router/routes/modules'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'
import PodcastShowView from '@/views/podcast/PodcastShowView.vue'

const makeJsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function deferredRequest() {
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Response>((_resolve, fail) => {
    reject = fail
  })
  return { promise, reject }
}

function episode(id: string, title: string) {
  return {
    id,
    audio_url: 'https://cdn.example.com/audio.mp3',
    duration_sec: 60,
    season_number: 1,
    episode_number: 1,
    post: { title, content: '说明' },
    channel: { name: '频道', slug: 'demo-show' },
  }
}

function show(slug: string, name: string) {
  return {
    channel: { id: `channel-${slug}`, slug, name },
    episodes: [episode(`episode-${slug}`, `${name} 单集`)],
  }
}

describe('podcast routing prefix', () => {
  let pinia = createPinia()

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps podcast consumer routes and excludes old creator routes', () => {
    const paths = moduleRoutes.podcast.flatMap(route => [
      route.path,
      ...((route.children || []).map(child => child.path)),
    ])

    expect(paths).toContain('episode/:id')
    expect(paths).toContain('show/:channelSlug')
    expect(paths).not.toContain('editor')
    expect(paths).not.toContain('editor/:id')
    expect(paths).not.toContain('creator')
  })

  it('keeps episode channel links under the podcast consumer prefix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({
      id: 'episode-1',
      audio_url: 'https://cdn.example.com/audio.mp3',
      duration_sec: 60,
      season_number: 1,
      episode_number: 1,
      post: { title: '测试单集', content: '说明' },
      channel: { name: '频道', slug: 'demo-show' },
    })))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-1')
    await router.isReady()

    const wrapper = mount(PodcastEpisodeView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.find('a[href="/podcasts/show/demo-show"]').exists()).toBe(true)
  })

  it('re-fetches and clears a previous show when channelSlug changes in the reused route component', async () => {
    const secondResponse = deferredResponse()
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/podcast/shows/show-a/episodes')) return Promise.resolve(makeJsonResponse(show('show-a', '节目 A')))
      return secondResponse.promise
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/show/:channelSlug', component: PodcastShowView }],
    })
    await router.push('/podcasts/show/show-a')
    await router.isReady()
    const wrapper = mount(PodcastShowView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('节目 A')

    await router.push('/podcasts/show/show-b')
    await nextTick()

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/podcast/shows/show-b/episodes'))).toBe(true)
    expect(wrapper.text()).not.toContain('节目 A')
    expect(wrapper.text()).toContain('加载中')

    secondResponse.resolve(makeJsonResponse(show('show-b', '节目 B')))
    await flushPromises()
    expect(wrapper.text()).toContain('节目 B')
  })

  it('does not let an earlier show response overwrite the current route', async () => {
    const firstResponse = deferredResponse()
    const fetchMock = vi.fn((url: string) => (
      url.endsWith('/podcast/shows/show-a/episodes')
        ? firstResponse.promise
        : Promise.resolve(makeJsonResponse(show('show-b', '节目 B')))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/show/:channelSlug', component: PodcastShowView }],
    })
    await router.push('/podcasts/show/show-a')
    await router.isReady()
    const wrapper = mount(PodcastShowView, { global: { plugins: [pinia, router] } })
    await nextTick()
    await router.push('/podcasts/show/show-b')
    await flushPromises()

    firstResponse.resolve(makeJsonResponse(show('show-a', '节目 A')))
    await flushPromises()
    expect(wrapper.text()).toContain('节目 B')
    expect(wrapper.text()).not.toContain('节目 A')
  })

  it('ends loading in the existing empty state without an unhandled rejection when the show request fails', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network failed'))))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/show/:channelSlug', component: PodcastShowView }],
    })
    await router.push('/podcasts/show/show-a')
    await router.isReady()
    const wrapper = mount(PodcastShowView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve))
    process.off('unhandledRejection', onUnhandled)

    expect(wrapper.text()).not.toContain('加载中')
    expect(wrapper.text()).toContain('节目不存在')
    expect(unhandled).toEqual([])
  })

  it('does not let an earlier failed show request change the current show state', async () => {
    const firstRequest = deferredRequest()
    vi.stubGlobal('fetch', vi.fn((url: string) => (
      url.endsWith('/podcast/shows/show-a/episodes')
        ? firstRequest.promise
        : Promise.resolve(makeJsonResponse(show('show-b', '节目 B')))
    )))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/show/:channelSlug', component: PodcastShowView }],
    })
    await router.push('/podcasts/show/show-a')
    await router.isReady()
    const wrapper = mount(PodcastShowView, { global: { plugins: [pinia, router] } })
    await nextTick()
    await router.push('/podcasts/show/show-b')
    await flushPromises()

    firstRequest.reject(new Error('network failed'))
    await flushPromises()

    expect(wrapper.text()).toContain('节目 B')
    expect(wrapper.text()).not.toContain('节目不存在')
  })

  it('re-fetches and clears a previous episode when id changes in the reused route component', async () => {
    const secondResponse = deferredResponse()
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/podcast/episodes/episode-a')) return Promise.resolve(makeJsonResponse(episode('episode-a', '单集 A')))
      if (url.endsWith('/podcast/episodes/episode-b')) return secondResponse.promise
      return Promise.resolve(makeJsonResponse({ data: [], meta: { total: 0 } }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-a')
    await router.isReady()
    const wrapper = mount(PodcastEpisodeView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('单集 A')

    await router.push('/podcasts/episode/episode-b')
    await nextTick()

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/podcast/episodes/episode-b'))).toBe(true)
    expect(wrapper.text()).not.toContain('单集 A')
    expect(wrapper.text()).toContain('加载中')

    secondResponse.resolve(makeJsonResponse(episode('episode-b', '单集 B')))
    await flushPromises()
    expect(wrapper.text()).toContain('单集 B')
  })

  it('does not let an earlier episode response overwrite the current route', async () => {
    const firstResponse = deferredResponse()
    const fetchMock = vi.fn((url: string) => (
      url.endsWith('/podcast/episodes/episode-a')
        ? firstResponse.promise
        : Promise.resolve(makeJsonResponse(episode('episode-b', '单集 B')))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
    })
    await router.push('/podcasts/episode/episode-a')
    await router.isReady()
    const wrapper = mount(PodcastEpisodeView, { global: { plugins: [pinia, router] } })
    await nextTick()
    await router.push('/podcasts/episode/episode-b')
    await flushPromises()

    firstResponse.resolve(makeJsonResponse(episode('episode-a', '单集 A')))
    await flushPromises()
    expect(wrapper.text()).toContain('单集 B')
    expect(wrapper.text()).not.toContain('单集 A')
  })
})
