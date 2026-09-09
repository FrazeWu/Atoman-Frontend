import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SubscriptionInboxToolbar from '@/components/feed/SubscriptionInboxToolbar.vue'

describe('SubscriptionInboxToolbar', () => {
  it('emits inbox actions and shows sync feedback', async () => {
    const wrapper = mount(SubscriptionInboxToolbar, {
      props: {
        unreadOnly: false,
        markingAllRead: false,
        refreshing: false,
        lastSyncedAt: '2026-09-09T08:00:00Z',
      },
    })

    await wrapper.get('[data-test="subscription-inbox-unread"]').trigger('click')
    await wrapper.get('[data-test="subscription-inbox-refresh"]').trigger('click')
    await wrapper.get('[data-test="subscription-inbox-mark-all-read"]').trigger('click')

    expect(wrapper.emitted('toggle-unread')).toHaveLength(1)
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.emitted('mark-all-read')).toHaveLength(1)
    expect(wrapper.text()).toContain('上次同步')
  })
})
