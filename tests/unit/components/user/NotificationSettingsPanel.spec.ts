import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NotificationSettingsPanel from '@/components/user/NotificationSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'

const PButtonStub = defineComponent({
  inheritAttrs: false,
  template: '<button v-bind="$attrs"><slot /></button>',
})

describe('NotificationSettingsPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
  })

  afterEach(() => vi.restoreAllMocks())

  it('loads notification preferences and saves one category independently', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [{ category: 'mention', event_type: 'comment_mention', enabled: false }],
      }), { status: 200 })
    })
    const wrapper = mount(NotificationSettingsPanel, { global: { stubs: { PButton: PButtonStub } } })
    await flushPromises()

    const mentionToggle = wrapper.get('[data-test="notification-mention"]')
    expect((mentionToggle.element as HTMLInputElement).checked).toBe(false)

    const likeToggle = wrapper.get('[data-test="notification-like"]')
    await likeToggle.setValue(false)
    await flushPromises()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/notifications/preferences', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('comment_like'),
    }))
    expect(wrapper.text()).toContain('点赞提醒已保存')
  })

  it('keeps the preference controls visible when saving fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const wrapper = mount(NotificationSettingsPanel, { global: { stubs: { PButton: PButtonStub } } })
    await flushPromises()

    await wrapper.get('[data-test="notification-like"]').setValue(false)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('通知偏好保存失败')
    expect(wrapper.find('[data-test="notification-like"]').exists()).toBe(true)
    expect((wrapper.get('[data-test="notification-like"]').element as HTMLInputElement).checked).toBe(true)
  })
  it('shows a retry action when preferences cannot be loaded', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    const wrapper = mount(NotificationSettingsPanel, { global: { stubs: { PButton: PButtonStub } } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('通知偏好加载失败')
    await wrapper.get('[data-test="notification-settings-retry"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="notification-like"]').exists()).toBe(true)
  })
})
