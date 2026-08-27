import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'

describe('UserBlogSettingsPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = { username: 'alice', email: 'alice@example.com' }
    authStore.token = 'token'
    authStore.isAuthenticated = true
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps the profile form unavailable until profile data loads', async () => {
    let resolveProfile!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/users/me')) {
        return new Promise<Response>((resolve) => { resolveProfile = resolve })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })
    const wrapper = mount(UserBlogSettingsPanel, { props: { includeAccountExtras: false } })
    expect(wrapper.find('[data-test="profile-settings-loading"]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)

    resolveProfile(new Response(JSON.stringify({ data: { display_name: 'Alice' } }), { status: 200 }))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.get('input[placeholder="用于展示的名称"]').element).not.toHaveProperty('disabled', true)
  })

  it('shows a retry action instead of an empty form when loading fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/users/me')) return new Response(null, { status: 503 })
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })
    const wrapper = mount(UserBlogSettingsPanel, { props: { includeAccountExtras: false } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('资料加载失败')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('button').text()).toContain('重试')
  })
})
