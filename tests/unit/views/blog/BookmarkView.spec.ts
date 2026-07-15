import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import BookmarkView from '@/views/blog/BookmarkView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mountView = () => mount(BookmarkView, {
  global: {
    plugins: [pinia],
    stubs: {
      PAvatar: true,
      PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
      PConfirm: {
        props: ['show', 'message', 'confirmText'],
        template: '<section v-if="show"><p>{{ message }}</p><button data-test="confirm-delete" @click="$emit(\'confirm\')">{{ confirmText }}</button><button data-test="cancel-delete" @click="$emit(\'cancel\')">取消</button></section>',
      },
      PEmpty: true,
      PEntry: true,
      PModal: true,
    },
  },
})

const deleteButton = (wrapper: ReturnType<typeof mountView>, folderName: string) =>
  wrapper.findAll('.sidebar-item').find((button) => button.text().includes(folderName))!.get('.delete-btn')

describe('BookmarkView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'DELETE') {
        return new Response(JSON.stringify({ error: 'delete failed' }), { status: 500 })
      }
      if (url.endsWith('/blog/bookmark-folders')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'folder-1', name: '稍后阅读' },
            { id: 'folder-2', name: '资料' },
          ],
        }), { status: 200 })
      }
      if (url.endsWith('/blog/bookmarks')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'user-1', username: 'user', email: 'user@example.com' }
  })

  it('keeps the delete confirmation and active folder when deletion fails', async () => {
    const wrapper = mountView()
    await flushPromises()

    const folderButton = wrapper.findAll('.sidebar-item').find((button) => button.text().includes('稍后阅读'))!
    await folderButton.trigger('click')
    await folderButton.get('.delete-btn').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="confirm-delete"]').exists()).toBe(true)
    expect(folderButton.classes()).toContain('sidebar-item-active')
    expect(wrapper.text()).toContain('删除失败，请重试')
  })

  it('clears the previous delete error while retrying', async () => {
    const wrapper = mountView()
    await flushPromises()

    const folderButton = wrapper.findAll('.sidebar-item').find((button) => button.text().includes('稍后阅读'))!
    await folderButton.get('.delete-btn').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('删除失败，请重试')

    let resolveRetry!: (response: Response) => void
    const pendingRetry = new Promise<Response>((resolve) => {
      resolveRetry = resolve
    })
    fetchMock.mockImplementationOnce(() => pendingRetry)

    await wrapper.get('[data-test="confirm-delete"]').trigger('click')

    expect(wrapper.text()).not.toContain('删除失败，请重试')
    resolveRetry(new Response(JSON.stringify({ error: 'delete failed again' }), { status: 500 }))
    await flushPromises()
  })

  it('does not let an old successful deletion close a newer folder session', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveFirstDelete!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveFirstDelete = resolve
    }))

    await deleteButton(wrapper, '稍后阅读').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await wrapper.get('[data-test="cancel-delete"]').trigger('click')
    await deleteButton(wrapper, '资料').trigger('click')

    resolveFirstDelete(new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 }))
    await flushPromises()

    expect(wrapper.find('[data-test="confirm-delete"]').exists()).toBe(true)
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()
    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect(String(deleteCalls.at(-1)?.[0])).toContain('/folder-2')
  })

  it('does not let an old failed deletion pollute a newer folder session', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveFirstDelete!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveFirstDelete = resolve
    }))

    await deleteButton(wrapper, '稍后阅读').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await wrapper.get('[data-test="cancel-delete"]').trigger('click')
    await deleteButton(wrapper, '资料').trigger('click')

    resolveFirstDelete(new Response(JSON.stringify({ error: 'delete failed' }), { status: 500 }))
    await flushPromises()

    expect(wrapper.find('[data-test="confirm-delete"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('删除失败，请重试')
  })

  it('sends only one delete request while the current session is pending', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveDelete = resolve
    }))

    await deleteButton(wrapper, '稍后阅读').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')

    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect(deleteCalls).toHaveLength(1)
    expect(wrapper.get('[data-test="confirm-delete"]').text()).toBe('删除中...')

    resolveDelete(new Response(JSON.stringify({ error: 'delete failed' }), { status: 500 }))
    await flushPromises()
  })

  it('keeps the delete session locked while refreshing after success', async () => {
    const wrapper = mountView()
    await flushPromises()

    let resolveRefresh!: (response: Response) => void
    fetchMock
      .mockImplementationOnce(async () => new Response(JSON.stringify({ data: { message: 'ok' } }), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveRefresh = resolve
      }))

    await deleteButton(wrapper, '稍后阅读').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()

    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect(deleteCalls).toHaveLength(1)
    expect(wrapper.get('[data-test="confirm-delete"]').text()).toBe('删除中...')

    resolveRefresh(new Response(JSON.stringify({ data: [
      { id: 'folder-1', name: '稍后阅读' },
      { id: 'folder-2', name: '资料' },
    ] }), { status: 200 }))
    await flushPromises()
  })
})
