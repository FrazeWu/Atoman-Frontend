import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import ForgotPasswordView from '@/views/auth/ForgotPasswordView.vue'

const routes = [
  { path: '/forgot-password', component: ForgotPasswordView },
  { path: '/login', component: { template: '<div>登录</div>' } },
	{ path: '/auth/oauth/confirm-account', component: { template: '<div>确认账号</div>' } },
]

describe('ForgotPasswordView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses the login card shell and registration step pattern', async () => {
    vi.stubEnv('PROD', false)
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/forgot-password')
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [router] } })

    expect(wrapper.get('.auth-page').exists()).toBe(true)
    expect(wrapper.get('.auth-card.auth-card--register').exists()).toBe(true)
    expect(wrapper.get('.auth-steps-indicator').exists()).toBe(true)
    expect(wrapper.get('.auth-code-input-group').exists()).toBe(true)
    expect(wrapper.get('.auth-footer').exists()).toBe(true)
  })

  it('sends a reset code and resets the password before returning to login', async () => {
    vi.stubEnv('PROD', false)
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'sent' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'reset' }), { status: 200 }))
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/forgot-password')
    const wrapper = mount(ForgotPasswordView, { global: { plugins: [router] } })

    await wrapper.get('[data-test="reset-email"]').setValue('Alice@Example.com')
    await wrapper.get('[data-test="send-reset-code"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/auth/password-reset/send-code', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com', turnstile_token: '' }),
    }))

    await wrapper.get('[data-test="reset-code"]').setValue('123456')
    await wrapper.get('[data-test="reset-next"]').trigger('click')
    await wrapper.get('[data-test="reset-password"]').setValue('new-password')
    await wrapper.get('[data-test="reset-password-confirm"]').setValue('new-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/auth/password-reset', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'alice@example.com',
        code: '123456',
        password: 'new-password',
        password_confirm: 'new-password',
      }),
    }))
    expect(router.currentRoute.value.fullPath).toBe('/login?reset=success')
  })

  it('returns to the pending OAuth confirmation after password recovery', async () => {
	vi.stubEnv('PROD', false)
	vi.spyOn(globalThis, 'fetch')
	  .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'sent' }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'reset' }), { status: 200 }))
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push('/forgot-password?oauth=resume')
	const wrapper = mount(ForgotPasswordView, { global: { plugins: [router] } })
	await wrapper.get('[data-test="reset-email"]').setValue('alice@example.com')
	await wrapper.get('[data-test="send-reset-code"]').trigger('click')
	await flushPromises()
	await wrapper.get('[data-test="reset-code"]').setValue('123456')
	await wrapper.get('[data-test="reset-next"]').trigger('click')
	await wrapper.get('[data-test="reset-password"]').setValue('new-password')
	await wrapper.get('[data-test="reset-password-confirm"]').setValue('new-password')
	await wrapper.get('form').trigger('submit')
	await flushPromises()
	expect(router.currentRoute.value.path).toBe('/auth/oauth/confirm-account')
  })

  it('rejects a reset password longer than 72 bytes', async () => {
	vi.stubEnv('PROD', false)
	const fetchMock = vi.spyOn(globalThis, 'fetch')
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push('/forgot-password')
	const wrapper = mount(ForgotPasswordView, { global: { plugins: [router] } })
	await wrapper.get('[data-test="reset-email"]').setValue('alice@example.com')
	await wrapper.get('[data-test="reset-code"]').setValue('123456')
	await wrapper.get('[data-test="reset-next"]').trigger('click')
	const password = 'a'.repeat(73)
	await wrapper.get('[data-test="reset-password"]').setValue(password)
	await wrapper.get('[data-test="reset-password-confirm"]').setValue(password)
	await wrapper.get('form').trigger('submit')
	expect(fetchMock).not.toHaveBeenCalled()
	expect(wrapper.text()).toContain('密码过长，请缩短后重试')
  })
})
