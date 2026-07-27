import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DMConversationPane from '@/components/dm/DMConversationPane.vue'

describe('DMConversationPane', () => {
  it('可请求加载更早消息', async () => {
    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: { id: 'c1', mailbox: { type: 'user', id: 'u1', display_name: '我', unread_count: 0 }, other_party: { type: 'user', id: 'u2', display_name: '对方' }, last_message_at: null, last_message_preview: '', unread_count: 0, blocked: false, reply_as: { type: 'user', id: 'u1', display_name: '我' } },
        messages: [], hasMore: true, loading: false,
      },
    })
    await wrapper.get('[data-testid="dm-load-older"]').trigger('click')
    expect(wrapper.emitted('load-older')).toHaveLength(1)
  })
})
