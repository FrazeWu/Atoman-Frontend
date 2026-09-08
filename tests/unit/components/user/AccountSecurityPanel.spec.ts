import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AccountSecurityPanel from '@/components/user/AccountSecurityPanel.vue'
import { useAuthStore } from '@/stores/auth'

const PConfirmStub = defineComponent({
  props: { show: Boolean, loading: Boolean },
  emits: ['confirm', 'cancel'],
  template: '<button v-if="show" data-test="confirm-revoke" :disabled="loading" @click="$emit(\'confirm\')">确认退出</button>',
})

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['side', 'mode', 'partialWidth'],
  template: '<section data-testid="security-right-sheet" :data-side="side" :data-mode="mode" :data-partial-width="partialWidth"><slot /></section>',
})

function response(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? undefined : { 'Content-Type': 'application/json' },
  })
}

describe('AccountSecurityPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = { username: 'alice', email: 'alice@example.com' }
    authStore.token = 'token'
    authStore.isAuthenticated = true
  })

  afterEach(() => vi.restoreAllMocks())

  it('distinguishes a failed session request from an empty session list', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/sessions')) return response(null, 503)
      return response({ activities: [] })
    })
    const wrapper = mount(AccountSecurityPanel, { props: { email: 'alice@example.com' } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('登录设备加载失败')
    expect(wrapper.text()).not.toContain('暂无活跃会话记录')
  })

  it('confirms before revoking another session and reloads the list', async () => {
    let sessionsRequestCount = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/sessions/other-session') && init?.method === 'DELETE') return response(null, 204)
      if (url.endsWith('/sessions')) {
        sessionsRequestCount += 1
        return sessionsRequestCount === 1
          ? response({ sessions: [
            { id: 'current-session', device_name: '当前浏览器', current: true },
            { id: 'other-session', device_name: '另一台设备', current: false },
          ] })
          : response({ sessions: [{ id: 'current-session', device_name: '当前浏览器', current: true }] })
      }
      return response({ activities: [] })
    })
    const wrapper = mount(AccountSecurityPanel, {
      props: { email: 'alice@example.com' },
      global: { stubs: { PConfirm: PConfirmStub, PSheet: PSheetStub } },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '详情')!.trigger('click')
    await wrapper.get('button.p-button--danger').trigger('click')
    expect(wrapper.find('[data-test="confirm-revoke"]').exists()).toBe(true)
    await wrapper.get('[data-test="confirm-revoke"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me/sessions/other-session', expect.objectContaining({
      method: 'DELETE',
    }))
    expect(wrapper.text()).not.toContain('另一台设备')
  })

  it('keeps device revoke actions inside the detail sheet', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/sessions')) {
        return response({ sessions: [
          { id: 'current', device_name: '当前设备', current: true },
          { id: 'other', device_name: '另一台设备', current: false },
        ] })
      }
      return response({ activities: [] })
    })
    const wrapper = mount(AccountSecurityPanel, {
      props: { email: 'alice@example.com' },
      global: { stubs: { PConfirm: PConfirmStub, PSheet: PSheetStub } },
    })
    await flushPromises()

    const sessionsSummary = wrapper.findAll('.settings-block')[1]
    expect(sessionsSummary?.text()).not.toContain('强制退出')
    await sessionsSummary?.findAll('button').find(button => button.text() === '详情')?.trigger('click')
    expect(wrapper.findAll('button').some(button => button.text() === '强制退出')).toBe(true)
  })

	it('renders inserted login methods between email and device summaries', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/sessions')) return response({ sessions: [{ id: 'current', device_name: '当前设备', current: true }] })
      return response({ activities: [{ id: 'activity-1', action: '登录', created_at: '2026-09-07T08:00:00Z' }] })
    })
    const wrapper = mount(AccountSecurityPanel, {
      props: { email: 'alice@example.com' },
      slots: { 'after-email': '<div data-test="login-methods">登录方式</div>' },
      global: { stubs: { PConfirm: PConfirmStub, PSheet: PSheetStub } },
    })
    await flushPromises()

    const text = wrapper.get('.account-security').text()
    expect(text.indexOf('修改邮箱')).toBeLessThan(text.indexOf('登录方式'))
		expect(text.indexOf('登录方式')).toBeLessThan(text.indexOf('登录设备'))
	})

	it('reads nested session and security activity responses', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input)
			if (url.endsWith('/sessions')) {
				return response({ data: { sessions: [{ id: 'nested-session', device_name: '嵌套设备', current: true }] } })
			}
			return response({ data: { activities: [{ id: 'nested-activity', action: '嵌套登录', created_at: '2026-09-07T08:00:00Z' }] } })
		})
		const wrapper = mount(AccountSecurityPanel, {
			props: { email: 'alice@example.com' },
			global: { stubs: { PConfirm: PConfirmStub, PSheet: PSheetStub } },
		})
		await flushPromises()

		expect(wrapper.text()).toContain('嵌套设备')
		expect(wrapper.text()).toContain('嵌套登录')
	})

	it('opens email and detail panels from the right', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/sessions')) return response({ sessions: [{ id: 'current', device_name: '当前设备', current: true }] })
      if (url.endsWith('/activities')) return response({ activities: [{ id: 'activity-1', action: '登录', created_at: '2026-09-07T08:00:00Z' }] })
      return response(null, 204)
    })
    const wrapper = mount(AccountSecurityPanel, {
      props: { email: 'alice@example.com' },
      global: { stubs: { PConfirm: PConfirmStub, PSheet: PSheetStub } },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '修改邮箱')!.trigger('click')
    expect(wrapper.findComponent(PSheetStub).props('side')).toBe('right')
    expect(wrapper.findComponent(PSheetStub).props('mode')).toBe('partial')

    await wrapper.findAll('button').find(button => button.text() === '详情')!.trigger('click')
    expect(wrapper.findAllComponents(PSheetStub)).toHaveLength(2)
    expect(wrapper.findAllComponents(PSheetStub).map(component => component.props('mode'))).toEqual(['partial', 'partial'])
  })
})
