import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import ChannelManageDetailView from '@/views/blog/ChannelManageDetailView.vue'

const replace = vi.fn()
const push = vi.fn()
const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ params: { slug: 'real-channel' } }),
  useRouter: () => ({ push, replace }),
}))

const mountView = () => mount(ChannelManageDetailView, {
  global: {
    plugins: [pinia],
    stubs: {
      PEmpty: true,
      PPageHeader: { template: '<header><slot name="action" /></header>' },
      PModal: { template: '<section data-test="modal"><slot /></section>' },
      PButton: {
        props: ['disabled'],
        template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
      },
    },
  },
})

describe('ChannelManageDetailView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    replace.mockReset()
    push.mockReset()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/real-channel')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'user-1',
          name: '真实频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [{
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '原合集',
          description: '原描述',
        }] }), { status: 200 })
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ error: {
          code: 'blog.collection_forbidden',
          message: 'You do not have permission to modify this collection',
        } }), { status: 403 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1' } as typeof authStore.user
  })

  it('合集保存被后端拒绝时保留弹窗和输入并显示后端错误', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')
    const nameInput = wrapper.get('input[placeholder="合集名称*"]')
    await nameInput.setValue('未保存的新名称')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)
    expect(wrapper.get('input[placeholder="合集名称*"]').element).toHaveProperty('value', '未保存的新名称')
    expect(wrapper.text()).toContain('You do not have permission to modify this collection')
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it('合集保存遇到网络错误时保留弹窗和输入并显示错误', async () => {
    const wrapper = mountView()
    await flushPromises()

    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') throw new Error('offline')
      throw new Error('unexpected fetch after initial load')
    })
    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')
    const nameInput = wrapper.get('input[placeholder="合集名称*"]')
    await nameInput.setValue('网络失败时保留')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)
    expect(wrapper.get('input[placeholder="合集名称*"]').element).toHaveProperty('value', '网络失败时保留')
    expect(wrapper.text()).toContain('网络错误，请重试')
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it('合集更新成功后关闭弹窗并刷新合集', async () => {
    const wrapper = mountView()
    await flushPromises()

    const initialFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'PUT') {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-1',
          name: '已更新合集',
        } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')
    await wrapper.get('input[placeholder="合集名称*"]').setValue('已更新合集')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    const updateCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(updateCall?.[0]).toBe('/api/v1/blog/collections/collection-1')
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      name: '已更新合集',
      description: '原描述',
    })
    expect(wrapper.find('[data-test="modal"]').exists()).toBe(false)
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(2)
  })

  it('新建合集被后端拒绝时保留弹窗和输入并显示嵌套错误', async () => {
    const wrapper = mountView()
    await flushPromises()

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/channels/channel-1/collections') && init?.method === 'POST') {
        return new Response(JSON.stringify({ error: {
          code: 'validation.invalid_request',
          message: 'Collection name is unavailable',
        } }), { status: 422 })
      }
      throw new Error(`unexpected fetch after initial load: ${String(input)}`)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '+ 新建合集')!.trigger('click')
    await wrapper.get('input[placeholder="合集名称*"]').setValue('未创建的新合集')
    await wrapper.findAll('button').find(button => button.text() === '创建')!.trigger('click')
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(createCall?.[0]).toBe('/api/v1/blog/channels/channel-1/collections')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      name: '未创建的新合集',
      description: '',
    })
    expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)
    expect(wrapper.get('input[placeholder="合集名称*"]').element).toHaveProperty('value', '未创建的新合集')
    expect(wrapper.text()).toContain('Collection name is unavailable')
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it.each([
    {
      name: '迟到失败',
      response: () => new Response(JSON.stringify({ error: {
        code: 'blog.collection_forbidden',
        message: 'A request failed',
      } }), { status: 403 }),
    },
    {
      name: '迟到成功',
      response: () => new Response(JSON.stringify({ data: {
        id: 'collection-1',
        name: 'A 已保存',
      } }), { status: 200 }),
    },
  ])('保存 A 后打开 B 时，A 的$name不能污染或关闭 B', async ({ response }) => {
    const wrapper = mountView()
    await flushPromises()

    let resolveSaveA!: (response: Response) => void
    const initialFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolveSaveA = resolve
        })
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')
    await wrapper.get('input[placeholder="合集名称*"]').setValue('A 修改')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '+ 新建合集')!.trigger('click')
    await wrapper.get('input[placeholder="合集名称*"]').setValue('B 新建')

    expect(wrapper.findAll('button').some(button => button.text() === '创建')).toBe(true)
    resolveSaveA(response())
    await flushPromises()

    expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('新建合集')
    expect(wrapper.get('input[placeholder="合集名称*"]').element).toHaveProperty('value', 'B 新建')
    expect(wrapper.text()).not.toContain('A request failed')
  })

  it('删除合集被后端拒绝时显示嵌套错误且不刷新', async () => {
    const wrapper = mountView()
    await flushPromises()

    const initialFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: {
          code: 'blog.collection_forbidden',
          message: 'You do not have permission to delete this collection',
        } }), { status: 403 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    const deleteButton = wrapper.findAll('button').find(button => button.text() === '删除')!
    await deleteButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('You do not have permission to delete this collection')
    expect(wrapper.text()).toContain('原合集')
    expect(deleteButton.attributes('disabled')).toBeUndefined()
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it('删除合集返回字符串错误时显示该错误且不刷新', async () => {
    const wrapper = mountView()
    await flushPromises()

    const initialFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: '合集仍包含内容' }), { status: 409 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('合集仍包含内容')
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it('删除合集遇到网络错误时显示错误且不刷新', async () => {
    const wrapper = mountView()
    await flushPromises()

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        throw new Error('offline')
      }
      throw new Error(`unexpected fetch after initial load: ${String(input)}`)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('网络错误，请重试')
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(1)
  })

  it('删除合集请求未完成时重复点击只发送一个 DELETE', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => { resolveDelete = resolve })
    const initialFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return deleteResponse
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    const deleteButton = wrapper.findAll('button').find(button => button.text() === '删除')!
    await deleteButton.trigger('click')
    await deleteButton.trigger('click')

    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect(deleteCalls).toHaveLength(1)
    expect(deleteButton.attributes('disabled')).toBeDefined()

    resolveDelete(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
    await flushPromises()
  })

  it('删除合集成功后刷新列表、恢复按钮并允许再次删除', async () => {
    const wrapper = mountView()
    await flushPromises()

    let refreshCount = 0
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/collections/') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      if (url.endsWith('/blog/channels/channel-1/collections') && !init?.method) {
        refreshCount += 1
        return Promise.resolve(new Response(JSON.stringify({ data: refreshCount === 1 ? [{
          id: 'collection-2',
          channel_id: 'channel-1',
          name: '第二合集',
          description: '',
        }] : [] }), { status: 200 }))
      }
      return Promise.reject(new Error(`unexpected fetch after initial load: ${url}`))
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    let deleteButton = wrapper.findAll('button').find(button => button.text() === '删除')!
    await deleteButton.trigger('click')
    await flushPromises()

    let collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(2)
    deleteButton = wrapper.findAll('button').find(button => button.text() === '删除')!
    expect(deleteButton.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('第二合集')

    await deleteButton.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2)
    collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(3)
    expect(wrapper.findAll('button').some(button => button.text() === '删除')).toBe(false)
  })

  it.each([
    {
      name: '网络失败',
      refresh: () => Promise.reject(new Error('refresh offline')),
    },
    {
      name: 'HTTP 500',
      refresh: () => Promise.resolve(new Response(JSON.stringify({ error: 'refresh failed' }), { status: 500 })),
    },
  ])('DELETE 成功但 refresh $name 时立即移除旧合集且不提示删除失败', async ({ refresh }) => {
    const wrapper = mountView()
    await flushPromises()

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      if (url.endsWith('/blog/channels/channel-1/collections') && !init?.method) return refresh()
      return Promise.reject(new Error(`unexpected fetch after initial load: ${url}`))
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('原合集')
    expect(wrapper.text()).not.toContain('网络错误，请重试')
    expect(wrapper.text()).not.toContain('删除失败，请重试')
    expect(wrapper.findAll('button').some(button => button.text() === '删除')).toBe(false)
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    const collectionLoads = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith('/blog/channels/channel-1/collections') && !init?.method)
    expect(collectionLoads).toHaveLength(2)
  })

  it('删除旧 refresh 晚于创建 refresh 返回时不能覆盖新合集', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveDeleteRefresh!: (response: Response) => void
    let resolveCreateRefresh!: (response: Response) => void
    const deleteRefresh = new Promise<Response>((resolve) => { resolveDeleteRefresh = resolve })
    const createRefresh = new Promise<Response>((resolve) => { resolveCreateRefresh = resolve })
    let refreshCount = 0
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      if (url.endsWith('/blog/channels/channel-1/collections') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-b',
          channel_id: 'channel-1',
          name: '新合集 B',
        } }), { status: 201 }))
      }
      if (url.endsWith('/blog/channels/channel-1/collections') && !init?.method) {
        refreshCount += 1
        return refreshCount === 1 ? deleteRefresh : createRefresh
      }
      return Promise.reject(new Error(`unexpected fetch after initial load: ${url}`))
    })

    await wrapper.findAll('button').find(button => button.text() === '合集')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '+ 新建合集')!.trigger('click')
    await wrapper.get('input[placeholder="合集名称*"]').setValue('新合集 B')
    await wrapper.findAll('button').find(button => button.text() === '创建')!.trigger('click')
    await flushPromises()

    resolveCreateRefresh(new Response(JSON.stringify({ data: [{
      id: 'collection-b',
      channel_id: 'channel-1',
      name: '新合集 B',
    }] }), { status: 200 }))
    await flushPromises()
    expect(wrapper.text()).toContain('新合集 B')

    resolveDeleteRefresh(new Response(JSON.stringify({ data: [{
      id: 'collection-1',
      channel_id: 'channel-1',
      name: '原合集',
    }] }), { status: 200 }))
    await flushPromises()

    expect(wrapper.text()).toContain('新合集 B')
    expect(wrapper.text()).not.toContain('原合集')
  })
})
