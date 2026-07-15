import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const episode = (id: string, title: string) => ({
  id,
  post_id: `post-${id}`,
  channel_id: 'channel-1',
  post: { id: `post-${id}`, title, content: `${title}说明` },
  channel: { id: 'channel-1', name: '节目', slug: 'show' },
  audio_url: `https://example.com/${id}.mp3`,
  duration_sec: 120,
  season_number: 1,
  episode_number: 1,
  created_at: '2026-07-15T00:00:00Z',
  updated_at: '2026-07-15T00:00:00Z',
})

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/podcasts/episode/:id', component: PodcastEpisodeView }],
})

const makeOptionalRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/podcasts/episode/:id?', component: PodcastEpisodeView }],
})

describe('PodcastEpisodeView', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['array', ['episode-a']],
  ])('does not request an invalid initial route id: %s', async (_label, rawId) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = makeOptionalRouter()
    await router.push('/podcasts/episode')
    ;(router.currentRoute.value.params as Record<string, unknown>).id = rawId
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.ep).toBeNull()
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.text()).toContain('单集不存在')
  })

  it('invalidates a pending episode request when the route id becomes invalid', async () => {
    const first = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => first.promise))
    const router = makeOptionalRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()

    await router.push('/podcasts/episode')
    await flushPromises()
    expect(wrapper.vm.$.setupState.ep).toBeNull()
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.text()).toContain('单集不存在')

    first.resolve(response(episode('episode-a', '过期单集')))
    await flushPromises()
    expect(wrapper.text()).not.toContain('过期单集')
    expect(wrapper.text()).toContain('单集不存在')
  })

  it('keeps loading the current episode when the previous response arrives first', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/episodes/episode-a') ? first.promise : second.promise
    )))
    const router = makeRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()

    await router.push('/podcasts/episode/episode-b')
    await flushPromises()
    first.resolve(response(episode('episode-a', '过期单集')))
    await flushPromises()

    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.text()).not.toContain('过期单集')

    second.resolve(response(episode('episode-b', '当前单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前单集')
  })

  it('loads a reused route id and ignores the previous episode response', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/podcast/episodes/episode-a')) return first.promise
      if (url.endsWith('/podcast/episodes/episode-b')) return second.promise
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = makeRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()

    await router.push('/podcasts/episode/episode-b')
    await flushPromises()
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/podcast/episodes/episode-b'))).toBe(true)

    second.resolve(response(episode('episode-b', '当前单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前单集')

    first.resolve(response(episode('episode-a', '过期单集')))
    await flushPromises()
    expect(wrapper.text()).toContain('当前单集')
    expect(wrapper.text()).not.toContain('过期单集')
  })

  it('clears the previous episode when the reused route returns non-2xx', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/episodes/episode-a')
        ? Promise.resolve(response(episode('episode-a', '原单集')))
        : Promise.resolve(response({ error: 'episode not found' }, 404))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const router = makeRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('原单集')

    await router.push('/podcasts/episode/episode-b')
    await flushPromises()

    expect(wrapper.text()).toContain('单集不存在')
    expect(wrapper.text()).not.toContain('原单集')
  })

  it('clears the previous episode and restores loading when the current request rejects', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/podcast/episodes/episode-a')
        ? Promise.resolve(response(episode('episode-a', '原单集')))
        : Promise.reject(new Error('offline'))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const router = makeRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('原单集')

    await router.push('/podcasts/episode/episode-b')
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.text()).not.toContain('原单集')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('does not update state when a response arrives after unmount', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const router = makeRouter()
    await router.push('/podcasts/episode/episode-a')
    const wrapper = mount(PodcastEpisodeView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    })
    await flushPromises()
    const state = wrapper.vm.$.setupState
    const before = { ep: state.ep, error: state.error, loading: state.loading }

    wrapper.unmount()
    pending.resolve(response(episode('episode-a', '卸载后单集')))
    await flushPromises()

    expect({ ep: state.ep, error: state.error, loading: state.loading }).toEqual(before)
  })
})
