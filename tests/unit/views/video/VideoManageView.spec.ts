import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import VideoManageView from '@/views/video/VideoManageView.vue'
import { useAuthStore } from '@/stores/auth'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
  }),
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const InputStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})

describe('VideoManageView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.stubGlobal('alert', vi.fn())

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', email: 'demo@example.com' } as never
    auth.isAuthenticated = true
  })

  it('点击视频编辑时跳转到视频编辑路由', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [
            { id: 'channel-1', name: '视频频道', content_type: 'video' },
            { id: 'channel-blog', name: '文章频道', content_type: 'blog' },
          ],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        })
      }
      if (url.includes('/blog/channels/channel-blog/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-blog', name: '文章合集', channel_id: 'channel-blog' }],
        })
      }
      if (url.includes('/videos?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [{
            id: 'video-1',
            title: '测试视频',
            status: 'published',
            created_at: '2026-06-30T00:00:00Z',
          }],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).not.toContain('文章合集')
    expect(wrapper.find('.col-count').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')

    expect(push).toHaveBeenCalledWith('/videos/edit/video-1')
  })

  it('creates a real video channel instead of falling back to a blog channel', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/blog/channels') && init?.method === 'POST') {
        return makeJsonResponse({ data: { id: 'channel-new', name: '新视频频道', content_type: 'video' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PCard: { template: '<div><slot /></div>' },
          PEmpty: true,
          PInput: InputStub,
          PModal: { template: '<section><slot /></section>' },
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PPress: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
          PSelect: true,
          PTextarea: InputStub,
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '新建频道')!.trigger('click')
    await wrapper.get('input').setValue('新视频频道')
    await wrapper.findAll('button').find((button) => button.text() === '创建')!.trigger('click')
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      name: '新视频频道',
      content_type: 'video',
    })
  })

  it('切换合集后忽略旧合集的慢列表响应', async () => {
    let resolveCollectionA!: (response: Response) => void
    let resolveCollectionB!: (response: Response) => void
    const collectionAResponse = new Promise<Response>((resolve) => {
      resolveCollectionA = resolve
    })
    const collectionBResponse = new Promise<Response>((resolve) => {
      resolveCollectionB = resolve
    })
    const listRequests: string[] = []
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }],
        }))
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return Promise.resolve(makeJsonResponse({
          data: [
            { id: 'collection-a', name: '合集 A', channel_id: 'channel-1' },
            { id: 'collection-b', name: '合集 B', channel_id: 'channel-1' },
          ],
        }))
      }
      if (url.includes('/videos?collection_id=collection-a')) {
        listRequests.push('collection-a')
        return collectionAResponse
      }
      if (url.includes('/videos?collection_id=collection-b')) {
        listRequests.push('collection-b')
        return collectionBResponse
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: true,
          PModal: true,
          PInput: true,
          PTextarea: true,
          PSelect: true,
          PCard: { template: '<div><slot /></div>' },
          PPress: true,
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('.collection-pill')[1].trigger('click')
    expect(listRequests).toEqual(['collection-a', 'collection-b'])

    resolveCollectionB(makeJsonResponse({
      data: [{
        id: 'video-b',
        title: '合集 B 视频',
        status: 'published',
        created_at: '2026-07-02T00:00:00Z',
      }],
    }))
    await flushPromises()
    expect(wrapper.text()).toContain('合集 B 视频')

    resolveCollectionA(makeJsonResponse({
      data: [{
        id: 'video-a',
        title: '合集 A 慢视频',
        status: 'published',
        created_at: '2026-07-01T00:00:00Z',
      }],
    }))
    await flushPromises()

    expect(wrapper.text()).toContain('合集 B 视频')
    expect(wrapper.text()).not.toContain('合集 A 慢视频')
  })

  it('删除接口返回非 2xx 时保留视频、显示错误并恢复按钮', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'collection-1', name: '合集 A', channel_id: 'channel-1' },
            { id: 'collection-2', name: '合集 B', channel_id: 'channel-1' },
          ],
        })
      }
      if (url.includes('/videos?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [{
            id: 'video-1',
            title: '待删除视频',
            status: 'published',
            created_at: '2026-06-30T00:00:00Z',
          }],
        })
      }
      if (url.includes('/videos?collection_id=collection-2')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/videos/video-1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ error: '删除暂不可用' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: true,
          PModal: true,
          PInput: true,
          PTextarea: true,
          PSelect: true,
          PCard: { template: '<div><slot /></div>' },
          PPress: true,
        },
      },
    })
    await flushPromises()

    const deleteButton = wrapper.get('.action-btn.danger')
    await deleteButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('待删除视频')
    expect(wrapper.get('[role="alert"]').text()).toBe('删除暂不可用')
    expect(deleteButton.attributes('disabled')).toBeUndefined()

    await wrapper.findAll('.collection-pill')[1].trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('网络失败后重试时清除旧错误并阻止重复提交', async () => {
    let rejectDelete!: (reason: Error) => void
    const pendingDeleteResponse = new Promise<Response>((_, reject) => {
      rejectDelete = reject
    })
    let deleteAttempts = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }],
        }))
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        }))
      }
      if (url.includes('/videos?collection_id=collection-1')) {
        return Promise.resolve(makeJsonResponse({
          data: [
            {
              id: 'video-1',
              title: '待删除视频 A',
              status: 'published',
              created_at: '2026-06-30T00:00:00Z',
            },
            {
              id: 'video-2',
              title: '待删除视频 B',
              status: 'published',
              created_at: '2026-07-01T00:00:00Z',
            },
          ],
        }))
      }
      if (url.endsWith('/videos/video-1') && init?.method === 'DELETE') {
        deleteAttempts += 1
        return deleteAttempts === 1
          ? Promise.reject(new Error('network unavailable'))
          : pendingDeleteResponse
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: true,
          PModal: true,
          PInput: true,
          PTextarea: true,
          PSelect: true,
          PCard: { template: '<div><slot /></div>' },
          PPress: true,
        },
      },
    })
    await flushPromises()

    const [deleteButton, otherDeleteButton] = wrapper.findAll('.action-btn.danger')
    await deleteButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('删除失败，请重试')
    expect(deleteButton.attributes('disabled')).toBeUndefined()

    await deleteButton.trigger('click')

    expect(deleteButton.attributes('disabled')).toBeDefined()
    expect(otherDeleteButton.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await otherDeleteButton.trigger('click')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2)

    rejectDelete(new Error('network unavailable again'))
    await flushPromises()

    expect(wrapper.text()).toContain('待删除视频 A')
    expect(wrapper.text()).toContain('待删除视频 B')
    expect(wrapper.get('[role="alert"]').text()).toBe('删除失败，请重试')
    expect(deleteButton.attributes('disabled')).toBeUndefined()
    expect(otherDeleteButton.attributes('disabled')).toBeUndefined()
  })

  it('删除期间切换合集后忽略旧合集的失败结果', async () => {
    let rejectDelete!: (reason: Error) => void
    const pendingDelete = new Promise<Response>((_, reject) => {
      rejectDelete = reject
    })
    const listRequests: string[] = []
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }],
        }))
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return Promise.resolve(makeJsonResponse({
          data: [
            { id: 'collection-a', name: '合集 A', channel_id: 'channel-1' },
            { id: 'collection-b', name: '合集 B', channel_id: 'channel-1' },
          ],
        }))
      }
      if (url.includes('/videos?collection_id=collection-a')) {
        listRequests.push('collection-a')
        return Promise.resolve(makeJsonResponse({
          data: [{
            id: 'video-a',
            title: '合集 A 视频',
            status: 'published',
            created_at: '2026-07-01T00:00:00Z',
          }],
        }))
      }
      if (url.includes('/videos?collection_id=collection-b')) {
        listRequests.push('collection-b')
        return Promise.resolve(makeJsonResponse({
          data: [{
            id: 'video-b',
            title: '合集 B 视频',
            status: 'published',
            created_at: '2026-07-02T00:00:00Z',
          }],
        }))
      }
      if (url.endsWith('/videos/video-a') && init?.method === 'DELETE') return pendingDelete
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: true,
          PModal: true,
          PInput: true,
          PTextarea: true,
          PSelect: true,
          PCard: { template: '<div><slot /></div>' },
          PPress: true,
        },
      },
    })
    await flushPromises()

    await wrapper.get('.action-btn.danger').trigger('click')
    await wrapper.findAll('.collection-pill')[1].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('合集 B 视频')

    rejectDelete(new Error('collection A delete failed'))
    await flushPromises()

    expect(wrapper.text()).toContain('合集 B 视频')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(listRequests).toEqual(['collection-a', 'collection-b'])
    expect((wrapper.vm as unknown as { deletingVideoId: string | null }).deletingVideoId).toBeNull()
    expect(wrapper.get('.action-btn.danger').attributes('disabled')).toBeUndefined()
  })

  it('删除成功后等待视频列表刷新完成再恢复删除锁', async () => {
    let resolveRefresh!: (response: Response) => void
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    })
    let deleteAttempts = 0
    let videoListRequests = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }],
        }))
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return Promise.resolve(makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        }))
      }
      if (url.includes('/videos?collection_id=collection-1')) {
        videoListRequests += 1
        if (videoListRequests === 1) {
          return Promise.resolve(makeJsonResponse({
            data: [{
              id: 'video-1',
              title: '已删除视频',
              status: 'published',
              created_at: '2026-06-30T00:00:00Z',
            }],
          }))
        }
        if (videoListRequests === 2) return pendingRefresh
        throw new Error(`unexpected video list request: ${videoListRequests}`)
      }
      if (url.endsWith('/videos/video-1') && init?.method === 'DELETE') {
        deleteAttempts += 1
        if (deleteAttempts === 1) {
          return Promise.resolve(new Response(JSON.stringify({ error: '删除暂不可用' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }))
        }
        return Promise.resolve(makeJsonResponse({ message: 'deleted' }))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: true,
          PModal: true,
          PInput: true,
          PTextarea: true,
          PSelect: true,
          PCard: { template: '<div><slot /></div>' },
          PPress: true,
        },
      },
    })
    await flushPromises()

    const deleteButton = wrapper.get('.action-btn.danger')
    await deleteButton.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('删除暂不可用')

    await deleteButton.trigger('click')
    await flushPromises()

    expect(videoListRequests).toBe(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect((wrapper.vm as unknown as { deletingVideoId: string | null }).deletingVideoId).toBe('video-1')

    resolveRefresh(makeJsonResponse({
      data: [{
        id: 'video-2',
        title: '保留视频',
        status: 'published',
        created_at: '2026-07-01T00:00:00Z',
      }],
    }))
    await flushPromises()

    expect(wrapper.text()).not.toContain('已删除视频')
    expect(wrapper.text()).toContain('保留视频')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect((wrapper.vm as unknown as { deletingVideoId: string | null }).deletingVideoId).toBeNull()
    expect(wrapper.get('.action-btn.danger').attributes('disabled')).toBeUndefined()
  })
})
