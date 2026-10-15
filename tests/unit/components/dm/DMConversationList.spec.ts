import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DMConversationList from '@/components/dm/DMConversationList.vue'
import type { DMConversation } from '@/api/dm'

const mockConversations: DMConversation[] = [
  {
    id: 'conv-1',
    mailbox: { type: 'user', id: 'u1', display_name: 'Alice', unread_count: 0 },
    other_party: { type: 'user', id: 'u2', display_name: 'Bob', avatar_url: 'https://example.com/bob.jpg' },
    last_message_at: '2026-10-15T14:30:00Z',
    last_message_preview: '下午好',
    unread_count: 2,
    blocked: false,
    reply_as: { type: 'user', id: 'u1', display_name: 'Alice' },
    last_message_is_outgoing: true,
  },
  {
    id: 'conv-2',
    mailbox: { type: 'user', id: 'u1', display_name: 'Alice', unread_count: 0 },
    other_party: { type: 'user', id: 'u3', display_name: 'Charlie' },
    last_message_at: '2026-10-14T09:00:00Z',
    last_message_preview: '收到，谢谢',
    unread_count: 0,
    blocked: false,
    reply_as: { type: 'user', id: 'u1', display_name: 'Alice' },
    last_message_is_outgoing: false,
  },
  {
    id: 'conv-3',
    mailbox: { type: 'user', id: 'u1', display_name: 'Alice', unread_count: 0 },
    other_party: { type: 'user', id: 'u4', display_name: 'Diana' },
    last_message_at: '2026-10-10T08:00:00Z',
    last_message_preview: '周末见',
    unread_count: 0,
    blocked: false,
    reply_as: { type: 'user', id: 'u1', display_name: 'Alice' },
  },
]

describe('DMConversationList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders list with avatars, names, previews and unread badges', () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: 'conv-1', loading: false, hasMore: false },
    })
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')
    expect(wrapper.find('[data-testid="dm-unread-badge"]').text()).toBe('2')

    // Check avatar for Bob
    const avatarImg = wrapper.find('[data-testid="dm-conversation-conv-1"] img')
    expect(avatarImg.exists()).toBe(true)
    expect(avatarImg.attributes('src')).toBe('https://example.com/bob.jpg')

    // Check outgoing checkmark for conv-1
    expect(wrapper.find('[data-testid="dm-conversation-conv-1"] [data-testid="dm-outgoing-icon"]').exists()).toBe(true)
  })

  it('filters conversations when typing in the search box', async () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: '', loading: false, hasMore: false },
    })
    const searchInput = wrapper.find('input[type="search"]')
    expect(searchInput.exists()).toBe(true)

    // Filter by name
    await searchInput.setValue('Charlie')
    expect(wrapper.text()).not.toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')

    // Filter by message preview
    await searchInput.setValue('下午好')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).not.toContain('Charlie')
  })

  it('emits open-conversation on item click', async () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: '', loading: false, hasMore: false },
    })
    await wrapper.find('[data-testid="dm-conversation-conv-1"]').trigger('click')
    expect(wrapper.emitted('open-conversation')?.[0]).toEqual(['conv-1'])
  })

  it('renders relative time format and fallback monogram when no avatar', () => {
    const wrapper = mount(DMConversationList, {
      props: { conversations: mockConversations, activeConversationId: '', loading: false, hasMore: false },
    })

    // Charlie has no avatar, should show monogram 'C'
    const charlieItem = wrapper.find('[data-testid="dm-conversation-conv-2"]')
    expect(charlieItem.find('img').exists()).toBe(false)
    expect(charlieItem.find('[data-testid="dm-avatar-fallback"]').text()).toBe('C')

    // Time formatting:
    // conv-2: 2026-10-14T09:00:00Z -> yesterday -> 昨天
    // conv-3: 2026-10-10T08:00:00Z -> older -> 10/10
    expect(charlieItem.text()).toContain('昨天')
    const dianaItem = wrapper.find('[data-testid="dm-conversation-conv-3"]')
    expect(dianaItem.text()).toContain('10/10')
  })
})
