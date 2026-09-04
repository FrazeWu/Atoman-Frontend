import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import VideoImportsView from '@/views/video/VideoImportsView.vue'
import { useAuthStore } from '@/stores/auth'

const makeResponse = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1', status: 'uploading', file_name: 'clip.mp4', file_size: 20 * 1024 * 1024,
  content_type: 'video/mp4', part_size: 10 * 1024 * 1024, progress_current: 10 * 1024 * 1024,
  progress_total: 20 * 1024 * 1024, completed_parts: [1],
  payload: { channel_id: 'channel-1', title: '演示视频', description: '', thumbnail_url: '', visibility: 'public', tags: [], collection_ids: ['collection-1'] },
  publish_mode: 'published', publish_requested_at: '2026-08-11T10:00:00Z', error_message: '',
  created_at: '2026-08-11T09:00:00Z', updated_at: '2026-08-11T10:00:00Z',
  ...overrides,
})

const createTestRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/studio/video/imports', component: VideoImportsView },
    { path: '/studio/video/new', component: { template: '<div />' } },
    { path: '/videos/watch/:id', component: { template: '<div />' } },
  ],
})

describe('VideoImportsView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('groups tasks and exposes recovery for a failed publication', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos/imports')) return makeResponse([
        task(),
        task({ id: 'task-2', status: 'failed', file_name: 'failed.mp4', payload: { ...task().payload, title: '失败视频' }, progress_current: 20 * 1024 * 1024, completed_parts: [1, 2], upload_completed_at: '2026-08-11T10:02:00Z', error_message: '发布失败' }),
      ])
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const router = createTestRouter()
    await router.push('/studio/video/imports?task=task-2')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const auth = useAuthStore(pinia)
    auth.token = 'token'

    const wrapper = mount(VideoImportsView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('导入中心')
    expect(wrapper.text()).toContain('需要处理 1')
    expect(wrapper.text()).toContain('失败视频')
    expect(wrapper.text()).toContain('发布失败')
    expect(wrapper.text()).toContain('重试发布')
  })

  it('selects an incomplete failed import and offers a fresh upload session', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/videos/imports')) return makeResponse([
        task({ id: 'task-3', status: 'failed', publish_mode: '', publish_requested_at: undefined, error_message: '视频文件内容无效' }),
      ])
      throw new Error(`unexpected fetch: ${String(input)}`)
    }))
    const router = createTestRouter()
    await router.push('/studio/video/imports')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    useAuthStore(pinia).token = 'token'

    const wrapper = mount(VideoImportsView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('需要处理 1')
    expect(wrapper.text()).toContain('重新开始上传')
    expect(wrapper.text()).toContain('选择原视频文件继续')
  })
})
