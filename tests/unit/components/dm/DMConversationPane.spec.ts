import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DMConversationPane from '@/components/dm/DMConversationPane.vue'
import type { DMConversation, DMMessage } from '@/api/dm'
import { useToast } from '@/composables/useToast'

const mockConversation: DMConversation = {
  id: 'c1',
  mailbox: { type: 'user', id: 'u1', display_name: '我', unread_count: 0 },
  other_party: { type: 'user', id: 'u2', display_name: '对方', avatar_url: 'https://example.com/other.png' },
  last_message_at: null,
  last_message_preview: '',
  unread_count: 0,
  blocked: false,
  reply_as: { type: 'user', id: 'u1', display_name: '我' },
}

describe('DMConversationPane', () => {
  it('可请求加载更早消息', async () => {
    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages: [],
        hasMore: true,
        loading: false,
      },
    })
    await wrapper.get('[data-testid="dm-load-older"]').trigger('click')
    expect(wrapper.emitted('load-older')).toHaveLength(1)
  })

  it('renders date divider across different days', () => {
    const messages: DMMessage[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        client_message_id: 'cli-1',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '昨天的问题',
        created_at: '2026-04-16T10:00:00Z',
      },
      {
        id: 'm2',
        conversation_id: 'c1',
        client_message_id: 'cli-2',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '今天的新消息',
        created_at: '2026-04-17T10:00:00Z',
      },
    ]

    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages,
        hasMore: false,
        loading: false,
      },
    })

    const dividers = wrapper.findAll('.dm-date-divider')
    expect(dividers.length).toBeGreaterThanOrEqual(2)
  })

  it('groups consecutive messages within 5 minutes from same sender', () => {
    const messages: DMMessage[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        client_message_id: 'cli-1',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '第一句话',
        created_at: '2026-04-17T10:00:00Z',
      },
      {
        id: 'm2',
        conversation_id: 'c1',
        client_message_id: 'cli-2',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '第二句话（2分钟后）',
        created_at: '2026-04-17T10:02:00Z',
      },
      {
        id: 'm3',
        conversation_id: 'c1',
        client_message_id: 'cli-3',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '第三句话（10分钟后，新分组）',
        created_at: '2026-04-17T10:12:00Z',
      },
    ]

    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages,
        hasMore: false,
        loading: false,
      },
    })

    const groups = wrapper.findAll('.dm-message-group')
    expect(groups).toHaveLength(2)

    const allMessages = wrapper.findAll('.dm-message')
    expect(allMessages).toHaveLength(3)
  })

  it('renders Option A bubble styles with micro-time and checkmark for outgoing messages', () => {
    const messages: DMMessage[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        client_message_id: 'cli-1',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '对方发来的',
        created_at: '2026-04-17T14:30:00Z',
      },
      {
        id: 'm2',
        conversation_id: 'c1',
        client_message_id: 'cli-2',
        sender: { type: 'user', id: 'u1', display_name: '我' },
        content: '我发出去的未读消息',
        created_at: '2026-04-17T14:32:00Z',
        read_at: null,
      },
      {
        id: 'm3',
        conversation_id: 'c1',
        client_message_id: 'cli-3',
        sender: { type: 'user', id: 'u1', display_name: '我' },
        content: '我发出去的已读消息',
        created_at: '2026-04-17T14:33:00Z',
        read_at: '2026-04-17T14:35:00Z',
      },
    ]

    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages,
        hasMore: false,
        loading: false,
      },
    })

    const incoming = wrapper.find('.dm-message:not(.self)')
    expect(incoming.exists()).toBe(true)
    const expectedIncomingTime = `${String(new Date(messages[0].created_at).getHours()).padStart(2, '0')}:${String(new Date(messages[0].created_at).getMinutes()).padStart(2, '0')}`
    expect(incoming.find('.dm-bubble-meta').text()).toContain(expectedIncomingTime)
    expect(incoming.find('.dm-bubble-check').exists()).toBe(false)

    const outgoingUnread = wrapper.findAll('.dm-message.self')[0]
    expect(outgoingUnread.exists()).toBe(true)
    expect(outgoingUnread.find('.dm-bubble-check.unread').exists()).toBe(true)
    expect(outgoingUnread.find('.dm-bubble-check.read').exists()).toBe(false)

    const outgoingRead = wrapper.findAll('.dm-message.self')[1]
    expect(outgoingRead.exists()).toBe(true)
    expect(outgoingRead.find('.dm-bubble-check.read').exists()).toBe(true)
    expect(outgoingRead.find('.dm-bubble-check.unread').exists()).toBe(false)
  })

  it('renders hover action toolbar with copy and report buttons and emits report', async () => {
    const messages: DMMessage[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        client_message_id: 'cli-1',
        sender: { type: 'user', id: 'u2', display_name: '对方' },
        content: '违规内容',
        created_at: '2026-04-17T10:00:00Z',
      },
      {
        id: 'm2',
        conversation_id: 'c1',
        client_message_id: 'cli-2',
        sender: { type: 'user', id: 'u1', display_name: '我' },
        content: '我的正常发言',
        created_at: '2026-04-17T10:01:00Z',
      },
    ]

    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages,
        hasMore: false,
        loading: false,
      },
    })

    const incomingMsg = wrapper.find('.dm-message:not(.self)')
    const reportBtn = incomingMsg.find('[data-testid="dm-report-message"]')
    expect(reportBtn.exists()).toBe(true)
    await reportBtn.trigger('click')
    expect(wrapper.emitted('report')?.[0]).toEqual(['m1'])

    const copyBtn = incomingMsg.find('[data-testid="dm-copy-message"]')
    expect(copyBtn.exists()).toBe(true)

    const toast = useToast()
    toast.clear()
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    })

    await copyBtn.trigger('click')
    expect(writeTextSpy).toHaveBeenCalledWith('违规内容')
    expect(toast.toasts.value.some((t) => t.message === '消息已复制' && t.type === 'success')).toBe(true)

    // Outgoing messages should not have report button
    const outgoingMsg = wrapper.find('.dm-message.self')
    expect(outgoingMsg.find('[data-testid="dm-report-message"]').exists()).toBe(false)
  })

  it('emits toggle-drawer when clicking header drawer button', async () => {
    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages: [],
        hasMore: false,
        loading: false,
      },
    })

    const drawerBtn = wrapper.find('[data-testid="dm-toggle-drawer"]')
    expect(drawerBtn.exists()).toBe(true)
    await drawerBtn.trigger('click')
    expect(wrapper.emitted('toggle-drawer')).toHaveLength(1)
  })

  it('toggles block status on block button click', async () => {
    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: mockConversation,
        messages: [],
        hasMore: false,
        loading: false,
      },
    })

    const blockBtn = wrapper.find('header button[data-testid="dm-header-block-btn"]')
    expect(blockBtn.exists()).toBe(true)
    expect(blockBtn.text()).toBe('拉黑')
    await blockBtn.trigger('click')
    expect(wrapper.emitted('block')).toHaveLength(1)

    await wrapper.setProps({
      conversation: { ...mockConversation, blocked: true },
    })
    expect(blockBtn.text()).toBe('取消拉黑')
    await blockBtn.trigger('click')
    expect(wrapper.emitted('unblock')).toHaveLength(1)
  })

  it('resolves sender display_name from conversation when message sender has uuid or missing name and avoids displaying raw uuid', () => {
    const rawUuid = '01a05581-b157-7017-b2d1-45088f5c8d09'
    const conversationWithRealName: DMConversation = {
      ...mockConversation,
      other_party: { type: 'user', id: rawUuid, display_name: 'cols/wys' },
    }
    const messages: DMMessage[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        client_message_id: 'cli-1',
        sender: { type: 'user', id: rawUuid, display_name: rawUuid }, // UUID leaked from API
        content: '可以 这下正常了',
        created_at: '2026-04-17T10:00:00Z',
      },
    ]

    const wrapper = mount(DMConversationPane, {
      props: {
        conversation: conversationWithRealName,
        messages,
        hasMore: false,
        loading: false,
      },
    })

    const senderSpan = wrapper.find('.dm-message-group__sender')
    expect(senderSpan.exists()).toBe(true)
    expect(senderSpan.text()).toBe('cols/wys')
    expect(wrapper.text()).not.toContain(rawUuid)
  })
})

