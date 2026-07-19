import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeOAuthProfile,
  confirmOAuthAccount,
  getPendingOAuth,
  setOAuthPassword,
} from '@/services/oauth'
import { useAuthStore } from '@/stores/auth'
import OAuthCompleteProfileView from '@/views/auth/OAuthCompleteProfileView.vue'
import OAuthConfirmAccountView from '@/views/auth/OAuthConfirmAccountView.vue'
import OAuthSetPasswordView from '@/views/auth/OAuthSetPasswordView.vue'

vi.mock('@/services/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/oauth')>()
  return {
    ...actual,
    getPendingOAuth: vi.fn(),
    completeOAuthProfile: vi.fn(),
    confirmOAuthAccount: vi.fn(),
    setOAuthPassword: vi.fn(),
    cancelPendingOAuth: vi.fn(),
  }
})

function makeRouter(component: object, path: string) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/forum', component: { template: '<div>forum</div>' } },
      { path: '/login', component: { template: '<div>login</div>' } },
      { path: '/forgot-password', component: { template: '<div>forgot password</div>' } },
    ],
  })
}

describe('OAuth pending views', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a new account after choosing a username and local password', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'google', stage: 'complete_profile', email: 'p***@example.com', has_password: false,
    })
    vi.mocked(completeOAuthProfile).mockResolvedValue({ returnTo: '/forum' })
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    vi.spyOn(auth, 'restoreSession').mockResolvedValue(true)
    const router = makeRouter(OAuthCompleteProfileView, '/auth/oauth/complete-profile')
    await router.push('/auth/oauth/complete-profile')
    const wrapper = mount(OAuthCompleteProfileView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('alice')
    await inputs[1].setValue('secret123')
    await inputs[2].setValue('secret123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(completeOAuthProfile).toHaveBeenCalledWith('alice', 'secret123', 'secret123')
    expect(auth.restoreSession).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/forum')
  })

  it('binds an existing account after password confirmation', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'microsoft', stage: 'confirm_account', email: 'a***@example.com', has_password: true,
    })
    vi.mocked(confirmOAuthAccount).mockResolvedValue({ returnTo: '/forum' })
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    vi.spyOn(auth, 'restoreSession').mockResolvedValue(true)
    const router = makeRouter(OAuthConfirmAccountView, '/auth/oauth/confirm-account')
    await router.push('/auth/oauth/confirm-account')
    const wrapper = mount(OAuthConfirmAccountView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('a***@example.com')
    await wrapper.get('input[type="password"]').setValue('secret')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(confirmOAuthAccount).toHaveBeenCalledWith('secret')
    expect(router.currentRoute.value.path).toBe('/forum')
  })

  it('offers recovery instead of password confirmation for an OAuth-only matching account', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'google', stage: 'confirm_account', email: 'a***@example.com', has_password: false,
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter(OAuthConfirmAccountView, '/auth/oauth/confirm-account')
    await router.push('/auth/oauth/confirm-account')
    const wrapper = mount(OAuthConfirmAccountView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('请先使用已绑定的登录方式登录，或重置密码')
    const links = wrapper.findAll('a').map(link => link.attributes('href'))
    expect(links).toContain('/login')
    expect(links).toContain('/forgot-password')
  })

  it('sets a local password before logging in an OAuth-only account', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'github', stage: 'set_password', email: 'a***@example.com', has_password: false,
    })
    vi.mocked(setOAuthPassword).mockResolvedValue({ returnTo: '/forum' })
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    vi.spyOn(auth, 'restoreSession').mockResolvedValue(true)
    const router = makeRouter(OAuthSetPasswordView, '/auth/oauth/set-password')
    await router.push('/auth/oauth/set-password')
    const wrapper = mount(OAuthSetPasswordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('secret123')
    await inputs[1].setValue('secret123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(setOAuthPassword).toHaveBeenCalledWith('secret123', 'secret123')
    expect(auth.restoreSession).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/forum')
  })

  it('rejects an OAuth local password longer than the bcrypt limit', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'github', stage: 'set_password', email: 'a***@example.com', has_password: false,
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter(OAuthSetPasswordView, '/auth/oauth/set-password')
    await router.push('/auth/oauth/set-password')
    const wrapper = mount(OAuthSetPasswordView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    const password = 'a'.repeat(73)
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue(password)
    await inputs[1].setValue(password)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(setOAuthPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('密码过长，请缩短后重试')
  })
})
