import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import LoginView from '@/views/auth/LoginView.vue'
import { shouldRequireTurnstileConfig } from '@/views/auth/turnstileConfig'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/feed', component: { template: '<div />' } },
  { path: '/login', component: LoginView },
  { path: '/register', component: LoginView },
]

afterEach(() => {
  vi.unstubAllEnvs()
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

const mountRegister = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })
  const authStore = useAuthStore()
  const register = vi.spyOn(authStore, 'register').mockResolvedValue()

  const wrapper = mount(LoginView, {
    global: {
      plugins: [pinia, router],
    },
  })

  await router.push('/register')
  await flushPromises()

  await wrapper.findAll('input')[0].setValue('alice@example.com')
  await wrapper.findAll('input')[1].setValue('123456')
  await wrapper.get('.auth-submit').trigger('click')

  await wrapper.findAll('input')[0].setValue('alice')
  await wrapper.findAll('input')[1].setValue('secret123')
  await wrapper.findAll('input')[2].setValue('secret123')
  const submitDisabled = wrapper.get('.auth-submit-btn').attributes('disabled')
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  return { register, submitDisabled }
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

  it('submits completed registration without requiring another turnstile token', async () => {
    const { register, submitDisabled } = await mountRegister()

    expect(submitDisabled).toBeUndefined()
    expect(register).toHaveBeenCalledWith(
      'alice',
      'alice@example.com',
      'secret123',
      'secret123',
      '123456',
    )
  })

  it('uses one turnstile challenge for the complete registration flow', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')

    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes })
    const authStore = useAuthStore()
    const register = vi.spyOn(authStore, 'register').mockResolvedValue()
    const reset = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'sent' }), { status: 200 }))

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
    await wrapper.get('[data-test="turnstile-verify"]').trigger('click')
    await wrapper.get('.auth-code-btn-inline').trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[1].setValue('123456')
    await wrapper.get('.auth-submit').trigger('click')

    expect(wrapper.find('[data-test="turnstile-verify"]').exists()).toBe(false)

    await wrapper.findAll('input')[0].setValue('alice')
    await wrapper.findAll('input')[1].setValue('secret123')
    await wrapper.findAll('input')[2].setValue('secret123')
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
