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
      global: { stubs: { PConfirm: PConfirmStub } },
    })
    await flushPromises()

    await wrapper.get('button.p-button--danger').trigger('click')
    expect(wrapper.find('[data-test="confirm-revoke"]').exists()).toBe(true)
    await wrapper.get('[data-test="confirm-revoke"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me/sessions/other-session', expect.objectContaining({
      method: 'DELETE',
    }))
    expect(wrapper.text()).not.toContain('另一台设备')
  })
})
