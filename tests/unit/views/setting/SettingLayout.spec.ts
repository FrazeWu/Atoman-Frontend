import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import SettingLayout from '@/views/setting/SettingLayout.vue'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/setting',
    component: SettingLayout,
    children: [
      { path: 'access', component: { template: '<div class="child-access">Access</div>' } },
      { path: 'feed-fulltext', component: { template: '<div class="child-feed">Feed</div>' } },
    ],
  },
]

describe('SettingLayout', () => {
  it('uses focus mode for /setting/access', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    await router.push('/setting/access')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ACard: { template: '<div><slot /></div>' },
          ASectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.find('.setting-layout__focus').exists()).toBe(true)
    expect(wrapper.find('.setting-layout__sidebar').exists()).toBe(false)
  })

  it('keeps shell navigation for other setting routes', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    await router.push('/setting/feed-fulltext')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ACard: { template: '<div><slot /></div>' },
          ASectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.find('.setting-layout__shell').exists()).toBe(true)
    expect(wrapper.find('.setting-layout__sidebar').exists()).toBe(true)
  })

  it('shows role management nav only for owner', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    const authStore = useAuthStore(pinia)
    authStore.user = { id: 1, username: 'owner', email: 'owner@example.com', role: 'owner' }

    await router.push('/setting/feed-fulltext')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ACard: { template: '<div><slot /></div>' },
          ASectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('用户权限')
  })
})
