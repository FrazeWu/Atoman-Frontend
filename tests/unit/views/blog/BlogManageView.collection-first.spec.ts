import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogManageView from '@/views/blog/BlogManageView.vue'
import { useAuthStore } from '@/stores/auth'

const openCollection = vi.fn()
const channelFor = vi.fn()

vi.mock('@/composables/useBlogSheets', () => ({
  useBlogSheets: () => ({ openCollection }),
}))

vi.mock('@/stores/defaultChannels', () => ({
  useDefaultChannelsStore: () => ({ channelFor }),
}))

const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

describe('BlogManageView collection-first workspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', email: 'demo@example.com' } as never
    auth.isAuthenticated = true
    openCollection.mockReset()
    channelFor.mockReturnValue({ id: 'channel-1', name: '产品笔记', slug: 'product-notes' })

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/channel-1/collections')) {
        return response([
          { id: 'default-1', channel_id: 'channel-1', name: '默认专栏', is_default: true },
          { id: 'collection-1', channel_id: 'channel-1', name: '界面与秩序', is_default: false },
        ])
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  const mountView = () => mount(BlogManageView, {
    global: {
      stubs: {
        PPageHeader: { props: ['title', 'sub'], template: '<header><h1>{{ title }}</h1><p>{{ sub }}</p><slot name="action" /></header>' },
        PEmpty: { props: ['title', 'description'], template: '<div>{{ title }} {{ description }}<slot name="action" /></div>' },
        PButton: { template: '<button><slot /></button>' },
        PLink: { props: ['label'], template: '<a>{{ label }}<slot /></a>' },
        PModal: { template: '<div><slot /></div>' },
        PInput: { template: '<input />' },
        PTextarea: { template: '<textarea />' },
      },
    },
  })

  it('shows only collections from the active channel with the default collection first', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('产品笔记')
    expect(wrapper.text()).toContain('全部文章')
    expect(wrapper.text()).toContain('界面与秩序')
    expect(wrapper.text()).not.toContain('总览')
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(expect.stringContaining('/blog/posts'), expect.anything())
  })

  it('opens a collection sheet instead of navigating', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="collection-card-collection-1"]').trigger('click')

    expect(openCollection).toHaveBeenCalledWith('collection-1', '界面与秩序', 'channel-1')
  })
})
