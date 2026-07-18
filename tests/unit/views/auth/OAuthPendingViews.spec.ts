import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeOAuthProfile,
  confirmOAuthAccount,
  getPendingOAuth,
} from '@/services/oauth'
import { useAuthStore } from '@/stores/auth'
import OAuthCompleteProfileView from '@/views/auth/OAuthCompleteProfileView.vue'
import OAuthConfirmAccountView from '@/views/auth/OAuthConfirmAccountView.vue'

vi.mock('@/services/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/oauth')>()
  return {
    ...actual,
    getPendingOAuth: vi.fn(),
    completeOAuthProfile: vi.fn(),
    confirmOAuthAccount: vi.fn(),
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
    ],
  })
}

describe('OAuth pending views', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a new account after choosing a username', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'google', stage: 'complete_profile', email: 'p***@example.com',
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

    await wrapper.get('input').setValue('alice')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(completeOAuthProfile).toHaveBeenCalledWith('alice')
    expect(auth.restoreSession).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/forum')
  })

  it('binds an existing account after password confirmation', async () => {
    vi.mocked(getPendingOAuth).mockResolvedValue({
      provider: 'apple', stage: 'confirm_account', email: 'a***@example.com',
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
})
