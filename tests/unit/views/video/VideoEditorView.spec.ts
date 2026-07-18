import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoEditorView from '@/views/video/VideoEditorView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

class FakeXMLHttpRequest {
  status = 200
  responseText = JSON.stringify({ url: '/uploads/video/files/user-1/video.mp4' })
  upload = { addEventListener: vi.fn() }
  private listeners: Record<string, Array<() => void>> = {}
  open = vi.fn()
  setRequestHeader = vi.fn()
  addEventListener(event: string, listener: () => void) {
    this.listeners[event] ??= []
    this.listeners[event].push(listener)
  }
  send() {
    queueMicrotask(() => this.listeners.load?.forEach(listener => listener()))
  }
}

const makeJsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

async function setup(path = '/studio/video/new?collection=collection-2') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/studio/video/new', component: VideoEditorView },
      { path: '/studio/video/:id/edit', component: VideoEditorView },
      { path: '/studio/video/content', component: { template: '<div />' } },
      { path: '/videos/watch/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const auth = useAuthStore(pinia)
  auth.isAuthenticated = true
  auth.token = 'token'
  auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
  const studio = useStudioStore(pinia)
  studio.loaded = true
  studio.channels = [
    { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' },
    { id: 'channel-2', name: '旧内容频道', slug: 'legacy', description: '', cover_url: '' },
  ]
  studio.currentChannel = studio.channels[0]
  studio.collections.video = [
    { id: 'collection-1', channel_id: 'channel-1', content_type: 'video', name: '默认合集', description: '', cover_url: '', is_default: true, created_at: '', updated_at: '' },
    { id: 'collection-2', channel_id: 'channel-1', content_type: 'video', name: '专题', description: '', cover_url: '', is_default: false, created_at: '', updated_at: '' },
  ]
  const wrapper = mount(VideoEditorView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, studio }
}

describe('VideoEditorView', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/videos') && init?.method === 'POST') return makeJsonResponse({ id: 'video-1' })
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'video') setTimeout(() => element.dispatchEvent(new Event('error')), 0)
      return element
    })
  })

  afterEach(() => {
    createElementSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('uses the Studio channel, hides the channel picker and preselects collection query', async () => {
    const { wrapper } = await setup()
    expect(wrapper.vm.$.setupState.form.channel_id).toBe('channel-1')
    expect(wrapper.vm.$.setupState.selectedCollectionIds).toEqual(['collection-2'])
    expect(wrapper.text()).not.toContain('关联频道')
  })

  it('keeps the uploaded video when automatic cover extraction fails', async () => {
    const { wrapper } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })

    await fileInput.trigger('change')

    await vi.waitFor(() => expect(wrapper.vm.$.setupState.errorMsg).toBe('自动封面生成失败，可手动上传封面'))
    expect(wrapper.vm.$.setupState.form.video_url).toBe('/uploads/video/files/user-1/video.mp4')
    expect(wrapper.vm.$.setupState.urlError).toBe('')
    expect(wrapper.text()).toContain('自动封面生成失败，可手动上传封面')
  })

  it('keeps the media information and publish steps inside Studio', async () => {
    const { wrapper } = await setup('/studio/video/new')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('媒体')

    wrapper.vm.$.setupState.form.video_url = 'https://example.com/video.mp4'
    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('信息')

    wrapper.vm.$.setupState.form.title = '三步视频'
    wrapper.vm.$.setupState.selectedCollectionIds = []
    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('发布')
    expect(wrapper.get('.ve-review').text()).toContain('三步视频')
  })

  it('saves a draft without collections and returns to content management', async () => {
    const { wrapper, router } = await setup('/studio/video/new')
    const form = wrapper.vm.$.setupState.form as { storage_type: string; title: string; video_url: string }
    form.storage_type = 'external'
    form.title = 'Draft video'
    form.video_url = 'https://example.com/video'
    wrapper.vm.$.setupState.selectedCollectionIds = []

    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    const fetchMock = vi.mocked(fetch)
    const postCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/videos') && init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ channel_id: 'channel-1', collection_ids: [], status: 'draft' })
    expect(router.currentRoute.value.fullPath).toBe('/studio/video/content')
  })

  it('requires a collection before publishing', async () => {
    const { wrapper } = await setup('/studio/video/new')
    const form = wrapper.vm.$.setupState.form as { storage_type: string; title: string; video_url: string }
    form.storage_type = 'external'
    form.title = 'Video'
    form.video_url = 'https://example.com/video'
    wrapper.vm.$.setupState.selectedCollectionIds = []

    wrapper.vm.$.setupState.requestPublish()
    await flushPromises()
    expect(wrapper.text()).toContain('请先选择合集')
    expect(wrapper.vm.$.setupState.showPublishConfirm).toBe(false)
  })

  it('switches Studio state for an edited video before loading collections', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos/video-1')) return makeJsonResponse({
        id: 'video-1', channel_id: 'channel-2', title: '旧视频', description: '', storage_type: 'external',
        video_url: 'https://example.com/video', thumbnail_url: '', visibility: 'public', tags: [], collections: [],
      })
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const { studio } = await setup('/studio/video/video-1/edit')
    expect(studio.selectChannel).toHaveBeenCalledWith('channel-2')
    expect(studio.loadCollections).toHaveBeenCalledWith('video')
  })
})
