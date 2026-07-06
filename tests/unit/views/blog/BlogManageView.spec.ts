import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogManageView from '@/views/blog/BlogManageView.vue'
import { useAuthStore } from '@/stores/auth'

const push = vi.fn()
const setDefaultChannel = vi.fn()
const channelFor = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
  }),
}))

vi.mock('@/stores/defaultChannels', () => ({
  useDefaultChannelsStore: () => ({
    setDefaultChannel,
    channelFor,
  }),
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('BlogManageView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    setDefaultChannel.mockReset()
    channelFor.mockReset()
    channelFor.mockReturnValue(null)

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', email: 'demo@example.com' } as never
    auth.isAuthenticated = true
  })

  it('loads both published posts and drafts for the selected collection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [{ id: 'channel-1', name: '频道一' }],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        })
      }
      if (url.includes('/blog/posts/drafts')) {
        return makeJsonResponse({
          data: [{
            id: 'draft-1',
            title: '草稿文章',
            status: 'draft',
            created_at: '2026-06-18T00:00:00Z',
            collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
          }],
        })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [{
            id: 'published-1',
            title: '已发布文章',
            status: 'published',
            created_at: '2026-06-17T00:00:00Z',
          }],
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BlogManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PLink: { template: '<a><slot /></a>' },
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/posts/drafts'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    )
    expect(wrapper.text()).toContain('已发布文章')
    expect(wrapper.text()).toContain('草稿文章')
    expect(wrapper.text()).toContain('草稿')
  })

  it('persists collection order when finishing sort mode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道一' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }] })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [
            { id: 'post-1', title: '文章一', status: 'published', created_at: '2026-06-18T00:00:00Z' },
            { id: 'post-2', title: '文章二', status: 'published', created_at: '2026-06-17T00:00:00Z' },
          ],
        })
      }
      if (url.includes('/blog/posts/drafts')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/collections/collection-1/posts/order')) {
        return makeJsonResponse({ data: { ok: true, method: init?.method, body: init?.body } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BlogManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PLink: { template: '<a><slot /></a>' },
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    const sortButton = wrapper.findAll('button').find((button) => button.text() === '排序')
    expect(sortButton).toBeTruthy()
    await sortButton!.trigger('click')
    await flushPromises()

    const upButtons = wrapper.findAll('button').filter((button) => button.text() === '↑')
    expect(upButtons.length).toBeGreaterThan(0)
    await upButtons[1].trigger('click')
    await flushPromises()

    const finishButton = wrapper.findAll('button').find((button) => button.text() === '完成排序')
    expect(finishButton).toBeTruthy()
    await finishButton!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/collections/collection-1/posts/order'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ post_ids: ['post-2', 'post-1'] }),
      }),
    )
  })

  it('persists mixed published and draft posts in the visible collection order', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '频道一' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }] })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [
            { id: 'published-1', title: '已发布文章', status: 'published', created_at: '2026-06-18T00:00:00Z' },
          ],
        })
      }
      if (url.includes('/blog/posts/drafts')) {
        return makeJsonResponse({
          data: [
            {
              id: 'draft-1',
              title: '草稿文章',
              status: 'draft',
              created_at: '2026-06-17T00:00:00Z',
              collections: [{ id: 'collection-1', channel_id: 'channel-1' }],
            },
          ],
        })
      }
      if (url.includes('/blog/collections/collection-1/posts/order')) {
        return makeJsonResponse({ data: { ok: true, method: init?.method, body: init?.body } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BlogManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PLink: { template: '<a><slot /></a>' },
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    const sortButton = wrapper.findAll('button').find((button) => button.text() === '排序')
    expect(sortButton).toBeTruthy()
    await sortButton!.trigger('click')
    await flushPromises()

    const upButtons = wrapper.findAll('button').filter((button) => button.text() === '↑')
    expect(upButtons.length).toBeGreaterThan(0)
    await upButtons[1].trigger('click')
    await flushPromises()

    const finishButton = wrapper.findAll('button').find((button) => button.text() === '完成排序')
    expect(finishButton).toBeTruthy()
    await finishButton!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/collections/collection-1/posts/order'),
      expect.objectContaining({
        body: JSON.stringify({ post_ids: ['draft-1', 'published-1'] }),
      }),
    )
  })

  it('点击设为默认频道时调用 blog 默认频道设置', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [{ id: 'channel-1', name: '频道一' }],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        })
      }
      if (url.includes('/blog/posts/drafts')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return makeJsonResponse({ data: [] })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(BlogManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PLink: { template: '<a><slot /></a>' },
          PPress: { props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    const defaultButton = wrapper.findAll('button').find((button) => button.text() === '设为默认频道')
    expect(defaultButton).toBeTruthy()

    await defaultButton!.trigger('click')

    expect(setDefaultChannel).toHaveBeenCalledWith('blog', 'channel-1')
  })

  it('当前频道是 blog 默认频道时显示默认状态', async () => {
    channelFor.mockReturnValue({
      id: 'channel-1',
      name: '频道一',
    })

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [{ id: 'channel-1', name: '频道一' }],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        })
      }
      if (url.includes('/blog/posts/drafts')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return makeJsonResponse({ data: [] })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(BlogManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PLink: { template: '<a><slot /></a>' },
          PPress: { props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    const defaultButton = wrapper.findAll('button').find((button) => button.text() === '当前默认频道')
    expect(defaultButton).toBeTruthy()
    expect(defaultButton!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('设为默认频道')
  })
})
