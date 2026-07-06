import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'

const mountedWrappers: Array<ReturnType<typeof mount>> = []
const inboxTotalUnread = ref(0)

vi.mock('@/stores/inbox', () => ({
  useInboxStore: () => ({
    totalUnread: inboxTotalUnread,
    bootstrap: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/feed/inbox', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

const mountTopbar = async () => {
  await router.push('/feed/inbox')
  await router.isReady()
  const wrapper = mount(AppTopbarAuthControls, {
    global: {
      plugins: [router],
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('AppTopbarAuthControls search trigger', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true
    authStore.token = 'token'
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return new Response(JSON.stringify({
          data: {
            blog: { id: 'blog-channel-1', name: '博客默认频道', slug: 'blog-default' },
            podcast: null,
            video: null,
          },
        }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('renders the search trigger before the inbox button and opens the dropdown on click', async () => {
    const wrapper = await mountTopbar()

    const searchTrigger = wrapper.find('[data-testid="topbar-search-pill"]')
    const inboxButton = wrapper.find('.notif-btn')

    expect(searchTrigger.exists()).toBe(true)
    expect(inboxButton.exists()).toBe(true)
    expect(searchTrigger.element.compareDocumentPosition(inboxButton.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)

    await searchTrigger.trigger('click')
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)
  })
})
