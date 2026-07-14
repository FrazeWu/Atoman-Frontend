import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import ChannelManageView from '@/views/blog/ChannelManageView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ChannelManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'channel-1', name: '真实频道', content_type: 'blog', is_default: false },
            { id: 'channel-video', name: '视频频道', content_type: 'video', is_default: false },
          ],
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ data: { message: 'Channel deleted' } }), { status: 200 })
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

  it('deletes through the real endpoint without asking for a password or showing fake counts', async () => {
    const wrapper = mount(ChannelManageView, {
      global: {
        plugins: [pinia],
        stubs: {
          PCard: { template: '<article><slot /></article>' },
          PClip: { props: ['label'], template: '<button>{{ label }}</button>' },
          PEmpty: true,
          PModal: { template: '<section><slot /><slot name="footer" /></section>' },
          PPageHeader: true,
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
          PReject: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('真实频道')
    expect(wrapper.text()).not.toContain('视频频道')
    expect(wrapper.text()).not.toContain('0 个合集')
    expect(wrapper.text()).not.toContain('0篇文章')

    await wrapper.findAll('button').find((button) => button.text() === '删除')!.trigger('click')
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    await wrapper.findAll('button').find((button) => button.text() === '确认删除')!.trigger('click')
    await flushPromises()

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(deleteCall?.[0]).toBe('/api/v1/blog/channels/channel-1')
    expect(deleteCall?.[1]?.body).toBeUndefined()
  })
})
