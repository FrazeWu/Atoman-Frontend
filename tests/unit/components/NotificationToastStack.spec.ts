import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NotificationToastStack from '@/components/system/NotificationToastStack.vue'
import { useInboxStore } from '@/stores/inbox'

let pinia: ReturnType<typeof createPinia>
const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

describe('NotificationToastStack', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    push.mockReset()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the newest toast at the stack bottom and expires each toast independently', async () => {
    const inbox = useInboxStore()
    inbox.toastItems = [
      { id: 'newest', kind: 'notification', category: 'system', title: '系统维护', body: '公告正文', href: '/inbox?tab=system', isAnnouncement: true },
      { id: 'older', kind: 'dm', category: 'dm', title: '新私信', body: '你好', href: '/inbox?tab=dm', isAnnouncement: false },
    ]
    const wrapper = mount(NotificationToastStack, { global: { plugins: [pinia] } })

    expect(wrapper.get('[data-toast-id="newest"]').attributes('style')).toContain('bottom: 0rem')
    expect(wrapper.get('[data-toast-id="older"]').attributes('style')).toContain('bottom: 5.875rem')

    await vi.advanceTimersByTimeAsync(8000)
    expect(inbox.toastItems).toEqual([])
  })

  it('opens the toast destination and leaves read-state management to the inbox detail page', async () => {
    const inbox = useInboxStore()
    inbox.toastItems = [
      { id: 'announcement', kind: 'notification', category: 'system', title: '系统维护', body: '公告正文', href: '/inbox?tab=system', isAnnouncement: true },
    ]
    const wrapper = mount(NotificationToastStack, { global: { plugins: [pinia] } })

    await wrapper.get('[data-toast-id="announcement"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/inbox?tab=system')
    expect(inbox.toastItems).toEqual([])
  })
})
