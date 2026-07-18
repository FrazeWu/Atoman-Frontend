import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastEditorView from '@/views/podcast/PodcastEditorView.vue'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'
import PodcastHomeView from '@/views/podcast/PodcastHomeView.vue'
import PodcastLayout from '@/views/podcast/PodcastLayout.vue'
import { useAuthStore } from '@/stores/auth'

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

function makeRouter(path: string, component: unknown) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component }],
  })
}

async function mountWithRouter(component: unknown, path: string, router: Router) {
  await router.push(path)
  await router.isReady()
  return mount(component, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: false,
        RouterView: true,
      },
    },
  })
}

describe('podcast routing prefix', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      return makeJsonResponse([])
    }))
  })

  it('恢复播客侧栏入口到 /podcasts 模块前缀', () => {
    const wrapper = mount(PodcastLayout, {
      global: {
        plugins: [createPinia()],
        stubs: {
          RouterView: true,
          PSidebar: { template: '<nav><slot /></nav>' },
          PSidebarItem: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.find('a[href="/podcasts"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/podcasts/editor"]').exists()).toBe(true)
  })

  it('首页发布按钮跳转到 /podcasts/editor', async () => {
    const router = makeRouter('/podcasts', PodcastHomeView)
    const push = vi.spyOn(router, 'push')
    const authStore = useAuthStore()
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastHomeView, '/podcasts', router)
    await flushPromises()
    push.mockClear()

    await wrapper.get('button').trigger('click')

    expect(push).toHaveBeenCalledWith('/podcasts/editor')
  })

  it('新建播客按媒体、信息、发布三步推进', async () => {
    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor', router)
    await flushPromises()

    expect(wrapper.get('[aria-current="step"]').text()).toContain('媒体')
    expect(wrapper.text()).not.toContain('基本信息')

    wrapper.vm.$.setupState.form.audio_url = 'https://cdn.example.com/audio.mp3'
    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('信息')
    expect(wrapper.text()).toContain('基本信息')

    wrapper.vm.$.setupState.form.title = '三步播客'
    wrapper.vm.$.setupState.form.channel_id = 'channel-1'
    await wrapper.get('[data-testid="creator-next"]').trigger('click')

    expect(wrapper.get('[aria-current="step"]').text()).toContain('发布')
    expect(wrapper.get('.pe-review').text()).toContain('三步播客')
    expect(wrapper.text()).toContain('保存草稿')
    expect(wrapper.text()).toContain('立即发布')
  })

  it('编辑已有播客直接进入信息步骤', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.includes('/podcast/episodes/episode-1')) {
        return makeJsonResponse({
          id: 'episode-1',
          channel_id: '',
          audio_url: 'https://cdn.example.com/audio.mp3',
          episode_cover_url: '',
          season_number: 1,
          episode_number: 1,
          post: { title: '已有播客', content: '', collections: [] },
          collections: [],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/editor/:id', component: PodcastEditorView }],
    })
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor/episode-1', router)
    await flushPromises()

    expect(wrapper.get('[aria-current="step"]').text()).toContain('信息')
    expect(wrapper.text()).toContain('基本信息')
  })

  it('新草稿保存后跳转到 /podcasts/editor/:id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/podcast/episodes') && init?.method === 'POST') {
        return makeJsonResponse({ id: 'episode-1' })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const push = vi.spyOn(router, 'push')
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor', router)
    await flushPromises()
    push.mockClear()

    const form = wrapper.vm.$.setupState.form as { title: string; audio_url: string }
    form.title = '测试单集'
    form.audio_url = 'https://cdn.example.com/audio.mp3'
    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/podcasts/creator?tab=manage')
  })

  it('新建单集应在合法频道下恢复 query.collection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '合集 1', channel_id: 'channel-1' },
            { id: 'collection-2', name: '合集 2', channel_id: 'channel-1' },
          ],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(
      PodcastEditorView,
      '/podcasts/editor?channel=channel-1&collection=collection-2',
      router,
    )
    await flushPromises()

    expect(wrapper.vm.$.setupState.selectedCollectionId).toBe('collection-2')
  })

  it('新建单集不得恢复不属于当前频道的非法 query.collection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '合集 1', channel_id: 'channel-1' },
            { id: 'collection-2', name: '合集 2', channel_id: 'channel-1' },
          ],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(
      PodcastEditorView,
      '/podcasts/editor?channel=channel-1&collection=collection-x',
      router,
    )
    await flushPromises()

    expect(wrapper.vm.$.setupState.selectedCollectionId).toBe('')
  })

  it('新建单集在没有 query.channel 时优先使用默认频道', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({
          data: {
            blog: null,
            podcast: { id: 'channel-2', name: '默认节目频道', slug: 'channel-2' },
            video: null,
          },
        })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({
          data: [
            { id: 'channel-1', name: '频道 1' },
            { id: 'channel-2', name: '频道 2' },
          ],
        })
      }
      if (url.includes('/blog/channels/channel-2/collections')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor', router)
    await flushPromises()

    expect(wrapper.vm.$.setupState.form.channel_id).toBe('channel-2')
  })

  it('可以在单集编辑页把当前频道设为默认频道', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels') && !init?.method) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/users/me/default-channels/podcast') && init?.method === 'PATCH') {
        return makeJsonResponse({ data: { id: 'channel-1', name: '频道', slug: 'channel-1' } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/podcast/episodes/episode-1')) {
        return makeJsonResponse({
          id: 'episode-1',
          channel_id: 'channel-1',
          audio_url: 'https://cdn.example.com/audio.mp3',
          episode_cover_url: '',
          season_number: 1,
          episode_number: 1,
          post: { title: '测试单集', content: '', collections: [] },
          collections: [],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/podcasts/editor/:id', component: PodcastEditorView }],
    })
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor/episode-1', router)
    await flushPromises()

    const button = wrapper.find('button.pe-default-channel-btn')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('设为默认频道')

    await button.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/default-channels/podcast'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ channel_id: 'channel-1' }),
      }),
    )
  })

  it('单集页频道链接指向 /podcasts/show/:slug', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse({
      id: 'episode-1',
      audio_url: 'https://cdn.example.com/audio.mp3',
      duration_sec: 60,
      season_number: 1,
      episode_number: 1,
      post: { title: '测试单集', content: '说明' },
      channel: { name: '频道', slug: 'demo-show' },
    })))
    const router = makeRouter('/podcasts/episode/:id', PodcastEpisodeView)

    const wrapper = await mountWithRouter(PodcastEpisodeView, '/podcasts/episode/episode-1', router)
    await flushPromises()

    expect(wrapper.find('a[href="/podcasts/show/demo-show"]').exists()).toBe(true)
  })
})
