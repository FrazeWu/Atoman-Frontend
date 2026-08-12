import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoEditorView from '@/views/video/VideoEditorView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

let autoCompleteUpload = true
let releaseUpload: (() => void) | null = null
let uploadNetworkFailures = 0

const importTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'import-1', status: 'uploading', file_name: 'clip.mp4', file_size: 5, content_type: 'video/mp4',
  part_size: 10 * 1024 * 1024, progress_current: 0, progress_total: 5, completed_parts: [],
  payload: { channel_id: 'channel-1', title: '', description: '', thumbnail_url: '', visibility: 'public', tags: [], collection_ids: [] },
  publish_mode: '', error_message: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...overrides,
})

const makeJsonResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

async function setup(path = '/studio/video/new?collection=collection-2', defaultStatus: 'draft' | 'published' = 'published') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/studio/video/new', component: VideoEditorView },
      { path: '/studio/video/:id/edit', component: VideoEditorView },
      { path: '/studio/video/content', component: { template: '<div />' } },
      { path: '/studio/video/imports', component: { template: '<div />' } },
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
	studio.settings.video = {
	  channel_id: 'channel-1', module: 'video', default_collection_id: defaultStatus === 'draft' ? 'collection-1' : null,
	  default_visibility: defaultStatus === 'draft' ? 'private' : 'public', default_publish_status: defaultStatus, autoplay_enabled: false,
	}
  const wrapper = mount(VideoEditorView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, studio }
}

describe('VideoEditorView', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    autoCompleteUpload = true
    releaseUpload = null
    uploadNetworkFailures = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/users/me/default-channels')) return makeJsonResponse({ data: { blog: null, podcast: null, video: null } })
      if (url.includes('/blog/channels?')) return makeJsonResponse({ data: [] })
      if (url.endsWith('/videos/imports') && init?.method === 'POST') return makeJsonResponse(importTask())
      if (url.endsWith('/videos/imports/import-1/parts/1') && init?.method === 'POST') return makeJsonResponse({ part_number: 1, upload_url: 'https://storage.test/part-1' })
      if (url === 'https://storage.test/part-1' && init?.method === 'PUT') {
        if (uploadNetworkFailures > 0) {
          uploadNetworkFailures -= 1
          throw new TypeError('Failed to fetch')
        }
        if (!autoCompleteUpload) await new Promise<void>(resolve => { releaseUpload = resolve })
        return new Response('', { status: 200, headers: { ETag: '"etag-1"' } })
      }
      if (url.endsWith('/videos/imports/import-1/parts/1/complete') && init?.method === 'POST') {
        return makeJsonResponse(importTask({ progress_current: 5, completed_parts: [1] }))
      }
      if (url.endsWith('/videos/imports/import-1/complete') && init?.method === 'POST') {
        return makeJsonResponse(importTask({ status: 'awaiting_submit', progress_current: 5, completed_parts: [1], upload_completed_at: new Date().toISOString() }))
      }
      if (url.endsWith('/videos/imports/import-1') && init?.method === 'PUT') return makeJsonResponse(importTask())
      if (url.endsWith('/videos/imports/import-1/submit') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        return makeJsonResponse(importTask({ publish_mode: body.publish_mode, publish_requested_at: new Date().toISOString() }))
      }
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

  it('applies Studio creation defaults', async () => {
    const { wrapper } = await setup('/studio/video/new', 'draft')
    expect(wrapper.vm.$.setupState.form.visibility).toBe('private')
    expect(wrapper.vm.$.setupState.selectedCollectionIds).toEqual(['collection-1'])
    expect(wrapper.vm.$.setupState.preferredPublishStatus).toBe('draft')
  })

  it('keeps the import task when automatic cover extraction fails', async () => {
    const { wrapper } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })

    await fileInput.trigger('change')

    await vi.waitFor(() => expect(wrapper.vm.$.setupState.videoUploaded).toBe(true))
    expect(wrapper.vm.$.setupState.videoImportId).toBe('import-1')
    expect(wrapper.vm.$.setupState.errorMsg).toBe('自动封面生成失败，可手动上传封面')
    expect(wrapper.vm.$.setupState.urlError).toBe('')
    expect(wrapper.text()).toContain('自动封面生成失败，可手动上传封面')
  })

  it('retries a transient object storage network failure', async () => {
    uploadNetworkFailures = 1
    const { wrapper } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })

    await fileInput.trigger('change')

    await vi.waitFor(() => expect(wrapper.vm.$.setupState.videoUploaded).toBe(true))
    expect(wrapper.vm.$.setupState.videoImportState.error).toBe('')
    const uploads = vi.mocked(fetch).mock.calls.filter(([input, init]) => String(input) === 'https://storage.test/part-1' && init?.method === 'PUT')
    expect(uploads).toHaveLength(2)
  })

  it('continues to information while the selected video is still uploading', async () => {
    autoCompleteUpload = false
    const { wrapper } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })

    await fileInput.trigger('change')
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.videoImportId).toBe('import-1'))
    expect(wrapper.vm.$.setupState.videoUploading).toBe(true)

    await wrapper.get('[data-testid="creator-next"]').trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('信息')

    releaseUpload?.()
    await flushPromises()
  })

  it('submits draft intent without waiting for the pending upload', async () => {
    autoCompleteUpload = false
    const { wrapper, router } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.videoImportId).toBe('import-1'))

    wrapper.vm.$.setupState.form.title = 'Uploading video'
    await wrapper.vm.$.setupState.saveDraft()
    await flushPromises()

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith('/videos/imports/import-1/submit') && init?.method === 'POST')).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/studio/video/imports?task=import-1')
    releaseUpload?.()
  })

  it('submits publish intent without waiting for the pending upload', async () => {
    autoCompleteUpload = false
    const { wrapper, router } = await setup('/studio/video/new')
    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
    await fileInput.trigger('change')
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.videoImportId).toBe('import-1'))

    wrapper.vm.$.setupState.form.title = 'Publishing video'
    wrapper.vm.$.setupState.selectedCollectionIds = ['collection-1']
    wrapper.vm.$.setupState.requestPublish()
    expect(wrapper.vm.$.setupState.showPublishConfirm).toBe(true)
    await wrapper.vm.$.setupState.doPublish()
    await flushPromises()

    const submitCall = vi.mocked(fetch).mock.calls.find(([input, init]) => String(input).endsWith('/videos/imports/import-1/submit') && init?.method === 'POST')
    expect(JSON.parse(String(submitCall?.[1]?.body))).toMatchObject({ publish_mode: 'published' })
    expect(router.currentRoute.value.fullPath).toBe('/studio/video/imports?task=import-1')
    releaseUpload?.()
  })

  it('keeps the media information and publish steps inside Studio', async () => {
    const { wrapper } = await setup('/studio/video/new')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('媒体')

    wrapper.vm.$.setupState.form.storage_type = 'external'
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
