import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import UserSettingsView from '@/views/user/UserSettingsView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const PDirectoryNavStub = defineComponent({
  name: 'PDirectoryNav',
  props: { mobileOpen: Boolean },
  template: '<div data-test="directory-nav" :data-mobile-open="String(mobileOpen)"></div>',
})

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/users/:handle', component: { template: '<div />' } },
    { path: '/users/:handle/settings', component: UserSettingsView },
  ],
})

const mountView = async (handle = 'alice') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.user = { id: 1, uuid: 'user-1', username: 'alice', email: 'alice@example.com', role: 'user' }
  authStore.token = 'token'
  authStore.isAuthenticated = true
  const feedStore = useFeedStore()
  vi.spyOn(feedStore, 'fetchGroups').mockResolvedValue(true)
  vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(true)
  vi.spyOn(feedStore, 'fetchSubscriptionRules').mockResolvedValue(true)

  const router = makeRouter()
  await router.push(`/users/${handle}/settings`)
  await router.isReady()
  const wrapper = mount(UserSettingsView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        PDirectoryNav: PDirectoryNavStub,
        PSurface: defineComponent({ template: '<section><slot /></section>' }),
        PPageHeader: defineComponent({ template: '<header />' }),
        PConfirm: defineComponent({ template: '<div />' }),
        UserBlogSettingsPanel: defineComponent({ template: '<div class="settings-block">博客资料</div>' }),
        PasswordSettingsPanel: defineComponent({ template: '<div class="settings-block">密码</div>' }),
        OAuthIdentitySettingsPanel: defineComponent({ template: '<div class="settings-block">登录方式</div>' }),
        AccountSecurityPanel: defineComponent({ template: '<div class="settings-block">账户安全</div>' }),
        SubscriptionRulesPanel: defineComponent({ template: '<div class="settings-block">订阅规则</div>' }),
        NotificationSettingsPanel: defineComponent({ template: '<div class="settings-block">通知偏好</div>' }),
        PrivacySettingsPanel: defineComponent({ template: '<div class="settings-block">隐私</div>' }),
        BlockedUsersSettingsPanel: defineComponent({ template: '<div class="settings-block">拉黑列表</div>' }),
        DMSettingsPanel: defineComponent({ template: '<div class="settings-block">私信</div>' }),
      },
    },
  })
  await flushPromises()
  return { wrapper, pinia }
}

describe('UserSettingsView UI', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses unified settings shell and exposes the mobile directory trigger', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.find('.settings-center').exists()).toBe(true)
    expect(wrapper.find('.user-settings__directory-trigger').exists()).toBe(true)
    expect(wrapper.findComponent(PDirectoryNavStub).exists()).toBe(true)
    expect(wrapper.findAll('.settings-center__section')).toHaveLength(4)
    expect(wrapper.find('.oauth-identities').exists()).toBe(false)
    expect(wrapper.findAll('.settings-block').length).toBeGreaterThanOrEqual(3)
  })

  it('does not mount private settings panels for another user URL', async () => {
    const { wrapper } = await mountView('bob')

    expect(wrapper.find('.settings-center__sections').exists()).toBe(false)
    expect(wrapper.findComponent(PDirectoryNavStub).exists()).toBe(false)
  })
  it('opens the mobile directory from the settings page', async () => {
    const { wrapper } = await mountView()
    const directory = wrapper.findComponent(PDirectoryNavStub)

    expect(directory.props('mobileOpen')).toBe(false)
    await wrapper.get('.user-settings__directory-trigger').trigger('click')
    expect(directory.props('mobileOpen')).toBe(true)
  })
})
