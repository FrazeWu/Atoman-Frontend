import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import CollectionView from '@/views/blog/CollectionView.vue'

const push = vi.fn()
const routerFailureMocks = vi.hoisted(() => ({
  navigationFailure: { type: 4, __navigationFailure: true },
  isNavigationFailure: vi.fn((value: unknown) => Boolean(
    value && typeof value === 'object' && '__navigationFailure' in value,
  )),
}))

vi.mock('vue-router', () => ({
  isNavigationFailure: routerFailureMocks.isNavigationFailure,
  useRoute: () => ({ params: { id: 'collection-1' } }),
  useRouter: () => ({ push }),
}))

const ownerViewStubs = {
  BookmarkFolderModal: true,
  PCard: { template: '<section><slot /></section>' },
  PClip: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
  PEmpty: true,
  PEntry: true,
  PLink: true,
  PModal: {
    props: ['modelValue', 'title'],
    template: '<div v-if="modelValue" data-testid="modal"><slot /></div>',
  },
  PPageHeader: { template: '<header><slot name="action" /></header>' },
  PPress: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
  PReject: {
    props: ['label', 'disabled'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  PSectionHeader: true,
}

const mountOwnerView = () => mount(CollectionView, {
  global: { stubs: ownerViewStubs },
})

describe('CollectionView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    routerFailureMocks.isNavigationFailure.mockClear()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return new Response(JSON.stringify({ data: [{
          id: 'post-1',
          collection_id: 'collection-1',
          title: '文章',
          content: '正文',
          status: 'published',
          updated_at: '2026-01-01T00:00:00Z',
        }] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('使用真实频道和文章详情路由', async () => {
    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PClip: true,
          PEmpty: true,
          PEntry: { props: ['title'], template: '<article @click="$emit(\'click\')">{{ title }}<slot name="actions" /></article>' },
          PLink: { props: ['href', 'label'], template: '<a :href="href">{{ label }}<slot /></a>' },
          PModal: true,
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('a[href="/channels/real-channel"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/post/post-1"]').exists()).toBe(true)
    await wrapper.get('article').trigger('click')
    expect(push).toHaveBeenCalledWith('/posts/post/post-1')
  })

  it('合集保存被后端拒绝时保留编辑框并提示失败', async () => {
    const authStore = useAuthStore()
    authStore.user = { uuid: 'author-1' } as typeof authStore.user

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          error: {
            code: 'blog.collection_forbidden',
            message: 'You do not have permission to modify this collection',
          },
        }), { status: 403 })
      }
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PEmpty: true,
          PEntry: true,
          PLink: true,
          PModal: {
            props: ['modelValue', 'title'],
            template: '<div v-if="modelValue" data-testid="modal"><slot /></div>',
          },
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    const editButton = wrapper.findAll('button').find(button => button.text() === '编辑')
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('保存失败，请重试')
  })

  it('删除合集被后端拒绝时保留确认框、显示嵌套错误且不导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: {
          code: 'blog.collection_forbidden',
          message: 'You do not have permission to delete this collection',
        } }), { status: 403 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const confirmButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('You do not have permission to delete this collection')
    expect(confirmButton.attributes('disabled')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('删除合集返回字符串错误时保留确认框、显示错误且不导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: '合集仍包含内容' }), { status: 409 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集仍包含内容')
    expect(push).not.toHaveBeenCalled()
  })

  it('删除合集遇到网络错误时保留确认框并显示错误', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.reject(new Error('offline'))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('网络错误，请重试')
    expect(push).not.toHaveBeenCalled()
  })

  it('删除请求未完成时重复确认只发送一个 DELETE', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const { PReject: _PReject, ...stubsWithRealReject } = ownerViewStubs
    const wrapper = mount(CollectionView, { global: { stubs: stubsWithRealReject } })
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => { resolveDelete = resolve })
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') return deleteResponse
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const confirmButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    await confirmButton.trigger('click')
    await confirmButton.trigger('click')

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(confirmButton.attributes('disabled')).toBeDefined()

    resolveDelete(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
    await flushPromises()
  })

  it('删除合集成功后关闭确认框、恢复 pending 并只导航一次', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/channels/real-channel')

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const reopenedDeleteButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(reopenedDeleteButton.attributes('disabled')).toBeUndefined()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      name: '失败',
      response: () => new Response(JSON.stringify({ error: {
        code: 'blog.collection_forbidden',
        message: 'A delete failed',
      } }), { status: 403 }),
    },
    {
      name: '成功',
      response: () => new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }),
    },
  ])('删除 A 的迟到$name响应不能污染、关闭或导航离开 B', async ({ response }) => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    let resolveDeleteA!: (response: Response) => void
    const deleteA = new Promise<Response>((resolve) => { resolveDeleteA = resolve })

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a') && init?.method === 'DELETE') return deleteA
      if (url.endsWith('/blog/collections/collection-a')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-a', channel_id: 'channel-1', name: '合集 A',
        } }), { status: 200 }))
      }
      if (url.endsWith('/blog/collections/collection-b')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-b', channel_id: 'channel-1', name: '合集 B',
        } }), { status: 200 }))
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'channel-1', user_id: 'author-1', name: '频道', slug: 'real-channel',
        } }), { status: 200 }))
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    }))

    const wrapper = mount(CollectionView, {
      props: { id: 'collection-a' },
      global: { stubs: ownerViewStubs },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await wrapper.setProps({ id: 'collection-b' })
    await flushPromises()
    if (wrapper.find('[data-testid="modal"]').exists()) {
      await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click')
    }
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    expect(wrapper.text()).toContain('合集 B')

    resolveDeleteA(response())
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集 B')
    expect(wrapper.text()).not.toContain('A delete failed')
    expect(push).not.toHaveBeenCalled()
  })

  it('组件卸载后删除成功的迟到响应不能导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => { resolveDelete = resolve })
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') return deleteResponse
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    wrapper.unmount()
    resolveDelete(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })

  it('删除成功但导航失败时显示返回路径，重试只再次导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    push.mockRejectedValueOnce(new Error('navigation failed')).mockResolvedValueOnce(undefined)
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集已删除，请返回频道')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find(button => button.text() === '返回频道')!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
  })

  it('router.push resolve NavigationFailure 时保留返回路径且重试不重复删除', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    push.mockResolvedValueOnce(routerFailureMocks.navigationFailure).mockResolvedValueOnce(undefined)
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(routerFailureMocks.isNavigationFailure).toHaveBeenCalledWith(routerFailureMocks.navigationFailure)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集已删除，请返回频道')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find(button => button.text() === '返回频道')!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
  })
})
