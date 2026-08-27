import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PrivacySettingsPanel from '@/components/user/PrivacySettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'

describe('PrivacySettingsPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
  })

  afterEach(() => vi.restoreAllMocks())

  it('loads and saves the private profile setting', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ data: { private_profile: false } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: { private_profile: true } }), { status: 200 })
    })
    const wrapper = mount(PrivacySettingsPanel)
    await flushPromises()

    const toggle = wrapper.get('[data-test="private-profile-toggle"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('仅自己可见')

    await toggle.setValue(false)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me/settings', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ private_profile: false }),
    }))
    expect(wrapper.text()).toContain('个人资料设置已保存')
  })

  it('shows a retry action when the settings request fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { private_profile: false } }), { status: 200 }))
    const wrapper = mount(PrivacySettingsPanel)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('隐私设置加载失败')
    await wrapper.get('[data-test="privacy-settings-retry"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="private-profile-toggle"]').exists()).toBe(true)
  })
})
