import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DMMailboxSelector from '@/components/dm/DMMailboxSelector.vue'

describe('DMMailboxSelector', () => {
  it('显示邮箱并发出选择事件', async () => {
    const wrapper = mount(DMMailboxSelector, {
      props: {
        mailboxes: [
          { type: 'user', id: 'user-1', display_name: '我', unread_count: 0 },
          { type: 'channel', id: 'channel-1', display_name: '低空飞行', unread_count: 2 },
        ],
        activeMailboxKey: 'user:user-1',
      },
    })

    expect(wrapper.get('[data-testid="dm-mailbox-selector"]').text()).toContain('频道：低空飞行')
    await wrapper.get('select').setValue('channel:channel-1')
    expect(wrapper.emitted('select-mailbox')?.[0]).toEqual(['channel:channel-1'])
  })
})
