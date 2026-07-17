import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoEditorView from '@/views/video/VideoEditorView.vue'
import { useAuthStore } from '@/stores/auth'

class FakeXMLHttpRequest {
  status = 200
  responseText = JSON.stringify({ url: '/uploads/video/files/user-1/video.mp4' })
  upload = {
    addEventListener: vi.fn(),
  }
  private listeners: Record<string, Array<() => void>> = {}

  open = vi.fn()
  setRequestHeader = vi.fn()

  addEventListener(event: string, listener: () => void) {
    this.listeners[event] ??= []
    this.listeners[event].push(listener)
  }

  send() {
    queueMicrotask(() => {
      this.listeners.load?.forEach(listener => listener())
    })
  }
}

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('VideoEditorView', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      clear: vi.fn(() => { storage = {} }),
      getItem: vi.fn((key: string) => storage[key] ?? null),
      removeItem: vi.fn((key: string) => { delete storage[key] }),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
    })
    globalThis.localStorage?.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'video') {
        setTimeout(() => {
          element.dispatchEvent(new Event('error'))
        }, 0)
      }
      return element
    })
  })

  afterEach(() => {
    createElementSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('视频上传成功后，自动封面提取失败不应把视频上传标记为失败', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/upload', component: VideoEditorView }],
    })
    await router.push('/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const storageSelect = wrapper.findComponent({ name: 'PSelect' })
    await storageSelect.vm.$emit('update:modelValue', 'local')
    await flushPromises()

    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })

    await fileInput.trigger('change')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('视频已上传')
    })

    expect(wrapper.text()).not.toContain('视频上传失败')
    expect(wrapper.text()).not.toContain('无法读取视频内容')
    expect(wrapper.text()).toContain('自动封面生成失败，可手动上传封面')
  })

  it('新建视频草稿保存后跳转到带 videos 前缀的编辑页', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return makeJsonResponse({ id: 'video-1' })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/videos/upload', component: VideoEditorView },
        { path: '/videos/edit/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/videos/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    editorView.vm.$.setupState.form.channel_id = 'channel-1'
    editorView.vm.$.setupState.selectedCollectionIds = ['collection-1']
    editorView.vm.$.setupState.form.storage_type = 'external'
    editorView.vm.$.setupState.form.title = 'Draft video'
    editorView.vm.$.setupState.form.video_url = 'https://example.com/video'

    const saveButton = wrapper.findAll('button').find(button => button.text() === '保存草稿')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/videos$/),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(router.currentRoute.value.fullPath).toBe('/videos/edit/video-1')
  })

  it('新建视频应在合法频道下恢复 query.collection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道 1' }] })
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
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/upload', component: VideoEditorView }],
    })
    await router.push('/videos/upload?channel=channel-1&collection=collection-2')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual(['collection-2'])
  })

  it('新建视频不得恢复不属于当前频道的非法 query.collection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道 1' }] })
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

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/upload', component: VideoEditorView }],
    })
    await router.push('/videos/upload?channel=channel-1&collection=collection-x')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    expect(editorView.vm.$.setupState.selectedCollectionIds).toEqual([])
  })

  it('新建视频在没有 query.channel 时优先使用默认频道', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) {
        return makeJsonResponse({
          data: {
            blog: null,
            podcast: null,
            video: { id: 'channel-2', name: '默认视频频道', slug: 'channel-2' },
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

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/upload', component: VideoEditorView }],
    })
    await router.push('/videos/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    expect(editorView.vm.$.setupState.form.channel_id).toBe('channel-2')
  })
})
