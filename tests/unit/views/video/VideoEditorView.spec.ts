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
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
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
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
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

    await wrapper.find('input[placeholder="为视频起一个吸引人的标题"]').setValue('Draft video')
    await wrapper.find('input[placeholder="https://youtube.com/watch?v=..."]').setValue('https://example.com/video')

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

  it('发布失败时保留确认弹窗和表单并显示后端错误', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return new Response(JSON.stringify({ error: '频道类型不匹配' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

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

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    await wrapper.find('input[placeholder="为视频起一个吸引人的标题"]').setValue('待发布视频')
    await wrapper.find('input[placeholder="https://youtube.com/watch?v=..."]').setValue('https://example.com/video')
    editorView.vm.$.setupState.requestPublish()
    await editorView.vm.$.setupState.doPublish()
    await flushPromises()

    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editorView.vm.$.setupState.form.title).toBe('待发布视频')
    expect(wrapper.text()).toContain('频道类型不匹配')
    expect(editorView.findComponent({ name: 'PConfirm' }).props('message')).toBe('频道类型不匹配')
  })

  it('发布请求进行中时忽略重复确认', async () => {
    let resolvePublish!: (response: Response) => void
    const publishResponse = new Promise<Response>((resolve) => {
      resolvePublish = resolve
    })
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return Promise.resolve(makeJsonResponse({ data: { video: null } }))
      }
      if (url.includes('/blog/channels?')) {
        return Promise.resolve(makeJsonResponse({ data: [] }))
      }
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return publishResponse
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/videos/upload', component: VideoEditorView },
        { path: '/videos/watch/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/videos/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    editorView.vm.$.setupState.form.title = '待发布视频'
    editorView.vm.$.setupState.form.video_url = 'https://example.com/video'
    editorView.vm.$.setupState.requestPublish()
    const firstPublish = editorView.vm.$.setupState.doPublish()
    const duplicatePublish = editorView.vm.$.setupState.doPublish()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    await editorView.vm.$nextTick()
    expect(editorView.findComponent({ name: 'PConfirm' }).props('confirmText')).toBe('发布中...')
    editorView.findComponent({ name: 'PConfirm' }).vm.$emit('cancel')
    await editorView.vm.$nextTick()
    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(true)

    resolvePublish(makeJsonResponse({ id: 'video-1' }))
    await Promise.all([firstPublish, duplicatePublish])
  })

  it('发布成功后的导航拒绝时重试只导航不重复发布', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
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
        { path: '/videos/watch/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/videos/upload')
    await router.isReady()

    let rejectNavigation!: (reason: Error) => void
    const navigation = new Promise<undefined>((_resolve, reject) => {
      rejectNavigation = reject
    })
    const pushSpy = vi.spyOn(router, 'push').mockReturnValue(navigation)

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    editorView.vm.$.setupState.form.title = '待发布视频'
    editorView.vm.$.setupState.form.video_url = 'https://example.com/video'
    const firstPublish = editorView.vm.$.setupState.doPublish()
    await vi.waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith('/videos/watch/video-1')
    })

    const duplicatePublish = editorView.vm.$.setupState.doPublish()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(editorView.vm.$.setupState.publishing).toBe(true)
    expect(editorView.findComponent({ name: 'PConfirm' }).props('confirmText')).toBe('发布中...')

    rejectNavigation(new Error('navigation failed'))
    await Promise.all([firstPublish, duplicatePublish])

    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editorView.vm.$.setupState.errorMsg).toBe('视频已发布，但跳转失败，请重试')
    expect(editorView.findComponent({ name: 'PConfirm' }).props('confirmText')).toBe('查看视频')

    pushSpy.mockResolvedValueOnce(undefined)
    await editorView.vm.$.setupState.doPublish()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(pushSpy).toHaveBeenCalledTimes(2)
    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(false)
  })

  it('路由返回 NavigationFailure 时保留已发布状态且重试不重复发布', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
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
        { path: '/videos/watch/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/videos/upload')
    await router.isReady()
    const removeGuard = router.beforeEach((to) => to.path.startsWith('/videos/watch/') ? false : true)

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    editorView.vm.$.setupState.form.title = '待发布视频'
    editorView.vm.$.setupState.form.video_url = 'https://example.com/video'
    await editorView.vm.$.setupState.doPublish()

    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(true)
    expect(editorView.vm.$.setupState.errorMsg).toBe('视频已发布，但跳转失败，请重试')
    expect(editorView.findComponent({ name: 'PConfirm' }).props('confirmText')).toBe('查看视频')

    removeGuard()
    await editorView.vm.$.setupState.doPublish()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(router.currentRoute.value.fullPath).toBe('/videos/watch/video-1')
    expect(editorView.vm.$.setupState.showPublishConfirm).toBe(false)
  })

  it('新建视频应在合法频道下恢复 query.collection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: { id: 'channel-default' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道 1', content_type: 'video' }] })
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
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: { id: 'channel-default' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道 1', content_type: 'video' }] })
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

  it('新建视频只保留视频频道并优先选择视频默认频道', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: { id: 'video-2', name: '默认视频', slug: 'video-2' } } })
      }
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [
          { id: 'blog-1', name: '博客频道', content_type: 'blog' },
          { id: 'video-1', name: '视频频道 1', content_type: 'video' },
          { id: 'video-2', name: '视频频道 2', content_type: 'video' },
        ] })
      }
      if (url.includes('/blog/channels/video-2/collections')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/upload', component: VideoEditorView }],
    })
    await router.push('/videos/upload?channel=blog-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    expect(editorView.vm.$.setupState.channels.map((channel: { id: string }) => channel.id)).toEqual(['video-1', 'video-2'])
    expect(editorView.vm.$.setupState.form.channel_id).toBe('video-2')
  })

  it('使用登录用户 UUID 请求真实频道列表', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: null } })
      }
      if (url.includes('/blog/channels?user_id=user-uuid-1')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/upload', component: VideoEditorView }],
    })
    await router.push('/videos/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-uuid-1', username: 'demo', email: 'demo@example.com' }
    auth.isAuthenticated = true

    mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/channels?user_id=user-uuid-1'),
      expect.any(Object),
    )
  })

  it('编辑视频时加载视频实际所属频道的合集', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-uuid-1')) {
        return makeJsonResponse({ data: [
          { id: 'channel-default', name: '默认频道', content_type: 'video' },
          { id: 'channel-video', name: '视频频道', content_type: 'video' },
        ] })
      }
      if (url.endsWith('/users/me/default-channels')) {
        return makeJsonResponse({ data: { video: { id: 'channel-default' } } })
      }
      if (url.includes('/blog/channels/channel-default/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-default', name: '默认合集' }] })
      }
      if (url.endsWith('/videos/video-1')) {
        return makeJsonResponse({
          id: 'video-1',
          channel_id: 'channel-video',
          title: '已有视频',
          description: '',
          storage_type: 'external',
          video_url: 'https://example.com/video',
          thumbnail_url: '',
          visibility: 'public',
          tags: [],
          collections: [{ id: 'collection-video', name: '视频合集' }],
        })
      }
      if (url.includes('/blog/channels/channel-video/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-video', name: '视频合集' }] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/edit/:id', component: VideoEditorView }],
    })
    await router.push('/videos/edit/video-1')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-uuid-1', username: 'demo', email: 'demo@example.com' }
    auth.isAuthenticated = true

    const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
    await flushPromises()

    const editorView = wrapper.findComponent(VideoEditorView)
    expect(editorView.vm.$.setupState.collections.map((collection: { id: string }) => collection.id)).toEqual(['collection-video'])
  })
})
