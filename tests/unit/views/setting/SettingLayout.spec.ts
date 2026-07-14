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
      { path: 'music-review', component: { template: '<div class="child-music">Music</div>' } },
      { path: 'roles', component: { template: '<div class="child-roles">Roles</div>' } },
    ],
  },
]

describe('SettingLayout', () => {
  it('uses one top navigation workspace for every setting page', async () => {
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
          PSectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.find('.setting-layout__workspace').exists()).toBe(true)
    expect(wrapper.find('.setting-layout__sidebar').exists()).toBe(false)
    expect(wrapper.get('.setting-layout__tabs').text()).toContain('全站')
    expect(wrapper.get('.setting-layout__tabs').text()).toContain('音乐')
  })

  it('does not expose separate feed setting nav entries', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    await router.push('/setting/music-review')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PSectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).not.toContain('全文抓取')
    expect(wrapper.text()).not.toContain('全局订阅源')
    expect(wrapper.text()).not.toContain('新增、编辑 external_rss')
  })

  it('shows role management nav only for owner', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    const authStore = useAuthStore(pinia)
    authStore.user = { id: 1, username: 'owner', email: 'owner@example.com', role: 'owner' }

    await router.push('/setting/music-review')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PSectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.get('.setting-layout__tabs').text()).toContain('用户')
  })

  it('hides user management from administrators', async () => {
    const pinia = createPinia()
    const router = createRouter({ history: createMemoryHistory(), routes })
    const authStore = useAuthStore(pinia)
    authStore.user = { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' }

    await router.push('/setting/music-review')
    await router.isReady()

    const wrapper = mount(SettingLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PSectionHeader: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.get('.setting-layout__tabs').text()).not.toContain('用户')
  })
})
