import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import LoginView from '@/views/auth/LoginView.vue'
import {
  isRetryableTurnstileError,
  shouldDisplayTurnstileError,
  resolveTurnstileErrorMessage,
  shouldRenderTurnstileForRegisterStep,
  shouldRequireTurnstileConfig,
} from '@/views/auth/turnstileConfig'
import { validateRegisterUsername } from '@/views/auth/registerValidation'
import { useAuthStore } from '@/stores/auth'

const loginViewSource = readFileSync(
  resolve(__dirname, '../../../../src/views/auth/LoginView.vue'),
  'utf8',
)

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/feed', component: { template: '<div />' } },
  { path: '/login', component: LoginView },
  { path: '/register', component: LoginView },
]

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

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
  it('inherits the shared input focus ring without a local focus override', () => {
    expect(loginViewSource).not.toContain('.auth-form :deep(.p-input:focus)')
  })

  it('shows configured OAuth providers with the safe return path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ providers: ['google'] }), { status: 200 }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push({ path: '/login', query: { redirect: '/forum' } })

    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.get('[data-test="oauth-provider-google"]').attributes('href'))
      .toBe('/api/v1/auth/oauth/google/start?purpose=login&return_to=%2Fforum')
  })

  it('links to password reset from the login form', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/login')
    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })

    const footer = wrapper.get('.auth-footer')
    const forgotPasswordLink = footer.get('[data-test="forgot-password-link"]')

    expect(footer.text()).toContain('没有账号？')
    expect(footer.text()).not.toContain('还没有账号？')
    expect(forgotPasswordLink.attributes('href')).toBe('/forgot-password')
    expect(forgotPasswordLink.classes()).toContain('auth-footer__forgot')
  })

  it('aligns the smaller password reset link to the right side of the footer', () => {
    const footerStyles = loginViewSource.match(/\.auth-footer\s*\{([^}]*)\}/)?.[1]
    const forgotPasswordStyles = loginViewSource.match(/\.auth-footer__forgot\s*\{([^}]*)\}/)?.[1]

    expect(footerStyles).toContain('display: flex;')
    expect(footerStyles).toContain('justify-content: space-between;')
    expect(forgotPasswordStyles).toContain('font-size: var(--a-text-xs);')
  })

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

  it('renders turnstile only before sending the verification code', () => {
    expect(shouldRenderTurnstileForRegisterStep(true, true, '0x4AAAAA', 1)).toBe(true)
    expect(shouldRenderTurnstileForRegisterStep(true, true, '0x4AAAAA', 2)).toBe(false)
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

  it('uses one turnstile challenge and keeps the completed register button clickable', async () => {
    vi.useFakeTimers()
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')

    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes })
    const authStore = useAuthStore()
    const register = vi.spyOn(authStore, 'register').mockResolvedValue()
    const reset = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/check-email') || url.endsWith('/auth/check-username')) {
        return new Response(JSON.stringify({ available: true }), { status: 200 })
      }
      return new Response(JSON.stringify({ message: 'sent' }), { status: 200 })
    })

    const TurnstileStub = defineComponent({
      name: 'TurnstileWidget',
      emits: ['verified', 'expired', 'error'],
      setup(_, { emit, expose }) {
        expose({ reset })
        return () => h('button', {
          type: 'button',
          'data-test': 'turnstile-verify',
          onClick: () => emit('verified', 'single-token'),
        })
      },
    })

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, router],
        stubs: { TurnstileWidget: TurnstileStub },
      },
    })
    await router.push('/register')
    await flushPromises()

    await wrapper.findAll('input')[0].setValue('alice@example.com')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('[data-test="turnstile-verify"]').trigger('click')
    await wrapper.get('.auth-code-btn-inline').trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[1].setValue('123456')
    await wrapper.get('.auth-submit').trigger('click')

    expect(wrapper.find('[data-test="turnstile-verify"]').exists()).toBe(false)

    await wrapper.findAll('input')[0].setValue('alice')
    await wrapper.findAll('input')[1].setValue('secret123')
    await wrapper.findAll('input')[2].setValue('secret123')

    expect(wrapper.get('.auth-submit-btn').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(reset).not.toHaveBeenCalled()
    expect(register).toHaveBeenCalledWith(
      'alice',
      'alice@example.com',
      'secret123',
      'secret123',
      '123456',
    )
  })
})
