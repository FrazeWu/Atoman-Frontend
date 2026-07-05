import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import LoginView from '@/views/auth/LoginView.vue'
import {
  buildRegisterTurnstileKey,
  isRetryableTurnstileError,
  shouldDisplayTurnstileError,
  resolveTurnstileErrorMessage,
  shouldRenderTurnstileForRegisterStep,
  shouldRequireTurnstileConfig,
} from '@/views/auth/turnstileConfig'
import { validateRegisterUsername } from '@/views/auth/registerValidation'
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

  it('uses different turnstile keys for different register steps', () => {
    expect(buildRegisterTurnstileKey(1)).toBe('register-turnstile-step-1')
    expect(buildRegisterTurnstileKey(2)).toBe('register-turnstile-step-2')
    expect(buildRegisterTurnstileKey(1)).not.toBe(buildRegisterTurnstileKey(2))
  })

  it('renders turnstile in the registration verification step as well as the final submit step', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/auth/LoginView.vue'), 'utf8')

    expect(source).toMatch(/REGISTER VIEW - STEP 1[\s\S]*<TurnstileWidget/)
    expect(source).toMatch(/REGISTER VIEW - STEP 2[\s\S]*<TurnstileWidget/)
  })

  it('renders turnstile in both register steps for production', () => {
    expect(shouldRenderTurnstileForRegisterStep(true, true, '0x4AAAAA', 1)).toBe(true)
    expect(shouldRenderTurnstileForRegisterStep(true, true, '0x4AAAAA', 2)).toBe(true)
    expect(shouldRenderTurnstileForRegisterStep(true, false, '0x4AAAAA', 1)).toBe(false)
    expect(shouldRenderTurnstileForRegisterStep(false, true, '0x4AAAAA', 1)).toBe(false)
    expect(shouldRenderTurnstileForRegisterStep(true, true, '', 1)).toBe(false)
  })

  it('treats transient turnstile failures as retryable', () => {
    expect(isRetryableTurnstileError(200500)).toBe(true)
    expect(isRetryableTurnstileError(300030)).toBe(true)
    expect(isRetryableTurnstileError(600010)).toBe(true)
    expect(isRetryableTurnstileError(110200)).toBe(false)
  })

  it('maps fatal turnstile codes to user-facing messages', () => {
    expect(resolveTurnstileErrorMessage(110200)).toBe('当前域名尚未完成验证配置，请稍后再试')
    expect(resolveTurnstileErrorMessage(110100)).toBe('当前无法完成验证，请稍后再试')
    expect(resolveTurnstileErrorMessage(400070)).toBe('当前无法完成验证，请稍后再试')
    expect(resolveTurnstileErrorMessage()).toBe('')
  })

  it('only surfaces known fatal turnstile errors to users', () => {
    expect(shouldDisplayTurnstileError(110200)).toBe(true)
    expect(shouldDisplayTurnstileError(110100)).toBe(true)
    expect(shouldDisplayTurnstileError(400070)).toBe(true)
    expect(shouldDisplayTurnstileError(200500)).toBe(false)
    expect(shouldDisplayTurnstileError()).toBe(false)
  })

  it('validates register usernames against site handle rules', () => {
    expect(validateRegisterUsername('alice-1')).toBeNull()
    expect(validateRegisterUsername('Alice')).toBe('用户名只能使用小写字母、数字或连字符')
    expect(validateRegisterUsername('a')).toBe('用户名长度需要在 2 到 30 个字符之间')
    expect(validateRegisterUsername('music')).toBe('该用户名暂时不可用')
    expect(validateRegisterUsername('media')).toBe('该用户名暂时不可用')
    expect(validateRegisterUsername('-alice')).toBe('用户名只能使用小写字母、数字或连字符')
  })
})
