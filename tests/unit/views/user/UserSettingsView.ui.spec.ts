import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  props: { mobileOpen: Boolean, mobileSide: String },
  template: '<div data-test="directory-nav" :data-mobile-open="String(mobileOpen)" :data-mobile-side="mobileSide"></div>',
})

const PConfirmStub = defineComponent({
  name: 'PConfirm',
  props: ['side'],
  template: '<div />',
})

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['show', 'side', 'mode'],
  template: '<section v-if="show" data-test="settings-right-sheet" :data-side="side" :data-mode="mode"><slot /></section>',
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
        PPageHeader: defineComponent({ template: '<header><slot name="action" /></header>' }),
        PConfirm: PConfirmStub,
        PSheet: PSheetStub,
        StudioSettingsView: defineComponent({ template: '<div data-test="studio-settings-panel" />' }),
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
    expect(wrapper.findComponent(PDirectoryNavStub).props('mobileSide')).toBe('right')
    expect(wrapper.findAll('.settings-center__section')).toHaveLength(6)
    expect(wrapper.find('.settings-center__section-head > p').exists()).toBe(true)
    expect(wrapper.find('.oauth-identities').exists()).toBe(false)
    expect(wrapper.findAll('.settings-block').length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the mobile directory action in the page header', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.find('header .user-settings__directory-trigger').exists()).toBe(true)
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

  it('includes module settings and immediate account cancellation area', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.get('[data-test="module-settings"]').text()).toContain('订阅')
    expect(wrapper.get('[data-test="module-settings"]').text()).toContain('博客')
    expect(wrapper.get('[data-test="module-settings"]').text()).toContain('视频')
    expect(wrapper.get('[data-test="module-settings"]').text()).toContain('播客')
    expect(wrapper.get('[data-test="module-settings"]').text()).toContain('文章发布和编辑器默认设置')
    expect(wrapper.get('[data-test="module-settings"]').text()).not.toContain('自动保存')
    expect(wrapper.get('[data-test="module-settings"]').text()).not.toContain('封面、摘要、标签、目录和版本历史')
    expect(wrapper.get('[data-test="delete-account"]').text()).toContain('注销账户')
    expect(wrapper.findAllComponents(PConfirmStub).some(component => component.props('side') === 'right')).toBe(true)
  })

  it('opens each module settings flow as a full right sheet', async () => {
    const { wrapper } = await mountView()

    const moduleSection = wrapper.get('[data-test="module-settings"]')
    const moduleButton = moduleSection.findAll('button').find(button => button.text() === '管理')
    expect(moduleButton).toBeDefined()
    await moduleButton!.trigger('click')

    const sheet = wrapper.get('[data-test="settings-right-sheet"]')
    expect(sheet.attributes('data-side')).toBe('right')
    expect(sheet.attributes('data-mode')).toBe('full')
  })

  it('keeps settings section descriptions and controls from colliding on tablets', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')

    expect(source).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.settings-center__section-head\s*\{[\s\S]*?display:\s*grid/)
    expect(source).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.settings-block\s*\{[\s\S]*?grid-template-columns:\s*1fr/)
  })

  it('keeps notification and security action rows from squeezing their copy', () => {
    const notificationSource = readFileSync(resolve(process.cwd(), 'src/components/user/NotificationSettingsPanel.vue'), 'utf8')
    const securitySource = readFileSync(resolve(process.cwd(), 'src/components/user/AccountSecurityPanel.vue'), 'utf8')

    expect(notificationSource).toMatch(/\.notification-settings__header\s*\{[\s\S]*?flex-wrap:\s*wrap/)
    expect(securitySource).toMatch(/\.security-summary-control\s*\{[\s\S]*?flex-wrap:\s*wrap/)
    expect(securitySource).toMatch(/\.account-security \.settings-block__control--form[\s\S]*?justify-items:\s*end/)
  })
})
