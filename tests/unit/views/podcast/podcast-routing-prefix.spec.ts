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
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse([])))
  })

  it('侧栏入口使用 /podcasts 模块前缀', () => {
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

  it('新草稿保存后跳转到 /podcasts/editor/:id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { podcast: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道', content_type: 'podcast' }] })
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
    const replace = vi.spyOn(router, 'replace')
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor', router)
    await flushPromises()
    replace.mockClear()

    const form = wrapper.vm.$.setupState.form as { title: string; audio_url: string }
    form.title = '测试单集'
    form.audio_url = 'https://cdn.example.com/audio.mp3'
    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    expect(replace).toHaveBeenCalledWith('/podcasts/editor/episode-1')
  })

  it('新建单集应在合法频道下恢复 query.collection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { podcast: { id: 'channel-default' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道', content_type: 'podcast' }] })
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
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { podcast: { id: 'channel-default' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道', content_type: 'podcast' }] })
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

  it('新建单集只保留播客频道并优先选择播客默认频道', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { podcast: { id: 'podcast-2', name: '默认播客', slug: 'podcast-2' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [
          { id: 'blog-1', name: '博客频道', content_type: 'blog' },
          { id: 'podcast-1', name: '播客频道 1', content_type: 'podcast' },
          { id: 'podcast-2', name: '播客频道 2', content_type: 'podcast' },
        ] })
      }
      if (url.includes('/blog/channels/podcast-2/collections')) {
        return makeJsonResponse({ data: [] })
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
      '/podcasts/editor?channel=blog-1',
      router,
    )
    await flushPromises()

    expect(wrapper.vm.$.setupState.channels.map((channel: { id: string }) => channel.id)).toEqual(['podcast-1', 'podcast-2'])
    expect(wrapper.vm.$.setupState.form.channel_id).toBe('podcast-2')
  })

  it('没有播客频道时不得提交草稿', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { podcast: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'blog-1', name: '博客频道', content_type: 'blog' }] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = makeRouter('/podcasts/editor', PodcastEditorView)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { id: 'user-1' } as never
    authStore.isAuthenticated = true

    const wrapper = await mountWithRouter(PodcastEditorView, '/podcasts/editor', router)
    await flushPromises()

    const form = wrapper.vm.$.setupState.form as { title: string; audio_url: string }
    form.title = '测试单集'
    form.audio_url = 'https://cdn.example.com/audio.mp3'
    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/podcast\/episodes$/),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(wrapper.vm.$.setupState.errorMsg).toBe('请选择节目频道')
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
