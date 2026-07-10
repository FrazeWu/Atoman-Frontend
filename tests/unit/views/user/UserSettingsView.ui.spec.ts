import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import UserSettingsView from '@/views/user/UserSettingsView.vue'
import { useAuthStore } from '@/stores/auth'

describe('UserSettingsView UI', () => {
  it('uses unified settings shell and setting blocks', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/users/:handle', component: { template: '<div />' } },
        { path: '/users/:handle/settings', component: UserSettingsView },
      ],
    })
    await router.push('/users/alice/settings')
    await router.isReady()

    const wrapper = mount(UserSettingsView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PSectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          PSurface: defineComponent({ template: '<section><slot /></section>' }),
          SubscriptionRulesPanel: defineComponent({ template: '<div class="settings-block">订阅规则</div>' }),
          UserBlogSettingsPanel: defineComponent({ template: '<div class="settings-block">博客资料</div>' }),
        },
      },
    })

    expect(wrapper.find('.settings-center').exists()).toBe(true)
    expect(wrapper.find('.settings-center__nav').exists()).toBe(true)
    expect(wrapper.findAll('.settings-block').length).toBeGreaterThanOrEqual(3)
  })
})
