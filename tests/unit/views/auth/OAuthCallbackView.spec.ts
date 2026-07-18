import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import OAuthCallbackView from '@/views/auth/OAuthCallbackView.vue'

describe('OAuthCallbackView', () => {
  it('restores the shared session and returns to the safe destination', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/oauth/callback', component: OAuthCallbackView },
        { path: '/forum', component: { template: '<div>forum</div>' } },
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/login', component: { template: '<div>login</div>' } },
      ],
    })
    const auth = useAuthStore()
    vi.spyOn(auth, 'restoreSession').mockResolvedValue(true)
    await router.push('/auth/oauth/callback?result=success&return_to=%2Fforum')

    mount(OAuthCallbackView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(auth.restoreSession).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/forum')
  })

  it('shows a recovery action when the provider login fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/oauth/callback', component: OAuthCallbackView },
        { path: '/login', component: { template: '<div>login</div>' } },
      ],
    })
    await router.push('/auth/oauth/callback?result=failed')

    const wrapper = mount(OAuthCallbackView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('登录未完成')
    expect(wrapper.get('[data-test="oauth-back-to-login"]').attributes('href')).toBe('/login')
  })
})
