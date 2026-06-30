import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import LoginView from '@/views/auth/LoginView.vue'
import { shouldRequireTurnstileConfig } from '@/views/auth/turnstileConfig'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/feed', component: { template: '<div />' } },
  { path: '/login', component: LoginView },
  { path: '/register', component: LoginView },
]

const mountLogin = async (redirect: string) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })
  await router.push({ path: '/login', query: { redirect } })

  const authStore = useAuthStore()
  vi.spyOn(authStore, 'loginWithPassword').mockResolvedValue()

  const wrapper = mount(LoginView, {
    global: {
      plugins: [pinia, router],
    },
  })

  await wrapper.findAll('input')[0].setValue('alice@example.com')
  await wrapper.findAll('input')[1].setValue('secret')
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  return router
}

describe('LoginView redirect', () => {
  it('keeps safe same-site relative redirects after login', async () => {
    const router = await mountLogin('/feed?tab=inbox')

    expect(router.currentRoute.value.fullPath).toBe('/feed?tab=inbox')
  })

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/feed\nnext',
  ])('falls back to home for unsafe redirect %s', async (redirect) => {
    const router = await mountLogin(redirect)

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('flags missing turnstile config only for production register routes', () => {
    expect(shouldRequireTurnstileConfig(true, true, '')).toBe(true)
    expect(shouldRequireTurnstileConfig(true, true, '0x4AAAAA')).toBe(false)
    expect(shouldRequireTurnstileConfig(true, false, '')).toBe(false)
    expect(shouldRequireTurnstileConfig(false, true, '')).toBe(false)
  })
})
