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

vi.mock('@/composables/useMediaChannel', () => ({
  useMediaChannel: () => ({
    channels: ref([]),
    currentMediaChannelId: ref(null),
    switchChannel: vi.fn(),
    clearChannels: vi.fn(),
    loadChannels: vi.fn(),
  }),
}))

vi.mock('@/components/system/TopbarSearchPopover.vue', () => ({
  default: {
    props: ['open'],
    template: '<div v-if="open" data-testid="topbar-search-popover-stub">popover</div>',
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/feed/inbox', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

const mountTopbar = () => {
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
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('renders the search input before the inbox button and opens popover on focus', async () => {
    const wrapper = mountTopbar()

    const searchInput = wrapper.find('.topbar-search-input')
    const inboxButton = wrapper.find('.notif-btn')

    expect(searchInput.exists()).toBe(true)
    expect(inboxButton.exists()).toBe(true)
    expect(searchInput.element.compareDocumentPosition(inboxButton.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('[data-testid="topbar-search-popover-stub"]').exists()).toBe(false)

    await searchInput.trigger('focus')
    expect(wrapper.find('[data-testid="topbar-search-popover-stub"]').exists()).toBe(true)
  })
})
