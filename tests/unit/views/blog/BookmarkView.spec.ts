import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import BookmarkView from '@/views/blog/BookmarkView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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
      PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
      PEntry: {
        props: ['title', 'summary'],
        template: '<article><h2>{{ title }}</h2><p>{{ summary }}</p><slot name="visual" /><slot name="meta" /><slot name="actions" /></article>',
      },
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

  it('atomically loads both authenticated data envelopes', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (
      String(input).endsWith('/blog/bookmark-folders')
        ? response({ data: [{ id: 'folder-1', name: '资料' }] })
        : response({ data: [{
          id: 'bookmark-1',
          bookmark_folder_id: 'folder-1',
          post: {
            id: 'post-1',
            title: '收藏文章',
            summary: '收藏摘要',
            likes_count: 7,
            comments_count: 4,
          },
        }] })
    ))

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock.mock.calls).toEqual([
      ['/api/v1/blog/bookmark-folders', { headers: { Authorization: 'Bearer token' } }],
      ['/api/v1/blog/bookmarks', { headers: { Authorization: 'Bearer token' } }],
    ])
    expect(wrapper.vm.$.setupState.folders).toEqual([{ id: 'folder-1', name: '资料' }])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([{
      id: 'bookmark-1',
      bookmark_folder_id: 'folder-1',
      post: {
        id: 'post-1',
        title: '收藏文章',
        summary: '收藏摘要',
        likes_count: 7,
        comments_count: 4,
      },
    }])
    expect(wrapper.text()).toContain('收藏文章')
    expect(wrapper.text()).toContain('♥ 7')
    expect(wrapper.text()).toContain('💬 4')
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
  })

  it('shows the real empty state only when both authenticated lists are empty', async () => {
    fetchMock.mockImplementation(async () => response({ data: [] }))

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('暂无收藏')
    expect(wrapper.text()).not.toContain('收藏加载失败')
    expect(wrapper.vm.$.setupState.folders).toEqual([])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([])
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
  })

  it.each([
    ['收藏夹 401', 'folders', () => Promise.resolve(response({ error: { message: 'Login required' } }, 401))],
    ['收藏 500', 'bookmarks', () => Promise.resolve(response({ error: { message: 'database unavailable' } }, 500))],
    ['收藏夹网络错误', 'folders', () => Promise.reject(new Error('offline'))],
    ['收藏网络错误', 'bookmarks', () => Promise.reject(new Error('offline'))],
    ['收藏夹错误 JSON', 'folders', () => Promise.resolve(new Response('not-json', { status: 200 }))],
    ['收藏错误 JSON', 'bookmarks', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('%s时整体失败且不半写', async (_label, failingTarget, failure) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const isFolders = String(input).endsWith('/blog/bookmark-folders')
      if ((failingTarget === 'folders') === isFolders) return failure()
      return Promise.resolve(response({ data: isFolders
        ? [{ id: 'folder-success', name: '不应写入的收藏夹' }]
        : [{ id: 'bookmark-success', post: { id: 'post-success', title: '不应写入的收藏' } }],
      }))
    })

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('收藏加载失败')
    expect(wrapper.text()).not.toContain('暂无收藏')
    expect(wrapper.vm.$.setupState.folders).toEqual([])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([])
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('旧双 GET 迟到%s时不解析或覆盖最新结果', async (_label, shouldReject) => {
    const oldFolders = deferred<Response>()
    const oldBookmarks = deferred<Response>()
    const oldFoldersResponse = response({ data: [{ id: 'old-folder', name: '旧收藏夹' }] })
    const oldBookmarksResponse = response({ data: [{ id: 'old-bookmark' }] })
    const oldFoldersJSON = vi.spyOn(oldFoldersResponse, 'json')
    const oldBookmarksJSON = vi.spyOn(oldBookmarksResponse, 'json')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockReturnValueOnce(oldFolders.promise)
      .mockReturnValueOnce(oldBookmarks.promise)
      .mockResolvedValueOnce(response({ data: [{ id: 'new-folder', name: '最新收藏夹' }] }))
      .mockResolvedValueOnce(response({ data: [{ id: 'new-bookmark' }] }))

    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await wrapper.vm.$.setupState.fetchAll()
    if (shouldReject) {
      oldFolders.reject(new Error('old folders failure'))
      oldBookmarks.resolve(oldBookmarksResponse)
    } else {
      oldFolders.resolve(oldFoldersResponse)
      oldBookmarks.resolve(oldBookmarksResponse)
    }
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(oldFoldersJSON).not.toHaveBeenCalled()
    expect(oldBookmarksJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.folders).toEqual([{ id: 'new-folder', name: '最新收藏夹' }])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([{ id: 'new-bookmark' }])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('旧请求失败和 finally 不污染仍在等待的最新加载', async () => {
    const oldFolders = deferred<Response>()
    const oldBookmarks = deferred<Response>()
    const latestFolders = deferred<Response>()
    const latestBookmarks = deferred<Response>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockReturnValueOnce(oldFolders.promise)
      .mockReturnValueOnce(oldBookmarks.promise)
      .mockReturnValueOnce(latestFolders.promise)
      .mockReturnValueOnce(latestBookmarks.promise)

    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const latestLoad = wrapper.vm.$.setupState.fetchAll()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))

    oldFolders.reject(new Error('old folders failure'))
    oldBookmarks.resolve(response({ data: [] }))
    await flushPromises()

    expect(wrapper.vm.$.setupState.folders).toEqual([])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()

    latestFolders.resolve(response({ data: [{ id: 'new-folder', name: '最新收藏夹' }] }))
    latestBookmarks.resolve(response({ data: [{ id: 'new-bookmark' }] }))
    await latestLoad

    expect(wrapper.vm.$.setupState.folders).toEqual([{ id: 'new-folder', name: '最新收藏夹' }])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([{ id: 'new-bookmark' }])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('旧双 JSON 迟到%s时不覆盖最新结果', async (_label, shouldReject) => {
    const oldFoldersData = deferred<unknown>()
    const oldBookmarksData = deferred<unknown>()
    const oldFoldersResponse = new Response(null, { status: 200 })
    const oldBookmarksResponse = new Response(null, { status: 200 })
    const oldFoldersJSON = vi.spyOn(oldFoldersResponse, 'json').mockReturnValue(oldFoldersData.promise)
    const oldBookmarksJSON = vi.spyOn(oldBookmarksResponse, 'json').mockReturnValue(oldBookmarksData.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockResolvedValueOnce(oldFoldersResponse)
      .mockResolvedValueOnce(oldBookmarksResponse)
      .mockResolvedValueOnce(response({ data: [{ id: 'new-folder', name: '最新收藏夹' }] }))
      .mockResolvedValueOnce(response({ data: [{ id: 'new-bookmark' }] }))

    const wrapper = mountView()
    await vi.waitFor(() => {
      expect(oldFoldersJSON).toHaveBeenCalledOnce()
      expect(oldBookmarksJSON).toHaveBeenCalledOnce()
    })
    await wrapper.vm.$.setupState.fetchAll()
    if (shouldReject) oldFoldersData.reject(new Error('old folders JSON failure'))
    else oldFoldersData.resolve({ data: [{ id: 'old-folder', name: '旧收藏夹' }] })
    oldBookmarksData.resolve({ data: [{ id: 'old-bookmark' }] })
    await flushPromises()

    expect(wrapper.vm.$.setupState.folders).toEqual([{ id: 'new-folder', name: '最新收藏夹' }])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([{ id: 'new-bookmark' }])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['双 GET 成功', 'fetch', false],
    ['双 GET 失败', 'fetch', true],
    ['双 JSON 成功', 'json', false],
    ['双 JSON 失败', 'json', true],
  ])('卸载后迟到的%s不写任何状态', async (_label, stage, shouldReject) => {
    const foldersPending = deferred<Response>()
    const bookmarksPending = deferred<Response>()
    const foldersData = deferred<unknown>()
    const bookmarksData = deferred<unknown>()
    const foldersResponse = new Response(null, { status: 200 })
    const bookmarksResponse = new Response(null, { status: 200 })
    const foldersJSON = vi.spyOn(foldersResponse, 'json').mockReturnValue(foldersData.promise)
    const bookmarksJSON = vi.spyOn(bookmarksResponse, 'json').mockReturnValue(bookmarksData.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    if (stage === 'fetch') {
      fetchMock.mockReturnValueOnce(foldersPending.promise).mockReturnValueOnce(bookmarksPending.promise)
    } else {
      fetchMock.mockResolvedValueOnce(foldersResponse).mockResolvedValueOnce(bookmarksResponse)
    }

    const wrapper = mountView()
    if (stage === 'fetch') {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    } else {
      await vi.waitFor(() => {
        expect(foldersJSON).toHaveBeenCalledOnce()
        expect(bookmarksJSON).toHaveBeenCalledOnce()
      })
    }
    wrapper.unmount()

    if (stage === 'fetch') {
      if (shouldReject) foldersPending.reject(new Error('late folders failure'))
      else foldersPending.resolve(foldersResponse)
      bookmarksPending.resolve(bookmarksResponse)
    } else {
      if (shouldReject) foldersData.reject(new Error('late folders JSON failure'))
      else foldersData.resolve({ data: [{ id: 'late-folder', name: '迟到收藏夹' }] })
      bookmarksData.resolve({ data: [{ id: 'late-bookmark' }] })
    }
    await flushPromises()

    if (stage === 'fetch') {
      expect(foldersJSON).not.toHaveBeenCalled()
      expect(bookmarksJSON).not.toHaveBeenCalled()
    }
    expect(wrapper.vm.$.setupState.folders).toEqual([])
    expect(wrapper.vm.$.setupState.bookmarks).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingPosts).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
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
