import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DMPartyProfileDrawer from '@/components/dm/DMPartyProfileDrawer.vue'
import type { DMParty, DMConversation } from '@/api/dm'

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

const mockParty: DMParty = {
  type: 'user',
  id: 'user-123',
  display_name: 'David',
  avatar_url: 'https://example.com/david.png',
}

const mockConv: DMConversation = {
  id: 'conv-123',
  mailbox: { type: 'user', id: 'my-id', display_name: 'Me', unread_count: 0 },
  other_party: mockParty,
  last_message_at: null,
  last_message_preview: '',
  unread_count: 0,
  blocked: false,
  reply_as: { type: 'user', id: 'my-id', display_name: 'Me' },
}

describe('DMPartyProfileDrawer', () => {
  const mountComponent = (props = {}) =>
    mount(DMPartyProfileDrawer, {
      props: {
        party: mockParty,
        conversation: mockConv,
        ...props,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

  it('renders party avatar, name, handle, and profile link', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('David')
    expect(wrapper.text()).toContain('user-123')
    expect(wrapper.text()).toContain('个人用户')

    const avatar = wrapper.find('.dm-drawer-avatar')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('src')).toBe('https://example.com/david.png')

    const profileLink = wrapper.find('a[href="/profile/user-123"]')
    expect(profileLink.exists()).toBe(true)
  })

  it('renders monogram fallback when avatar_url is missing', () => {
    const wrapper = mountComponent({
      party: {
        type: 'user',
        id: 'user-456',
        display_name: 'Alice',
      },
    })

    expect(wrapper.find('.dm-drawer-avatar').exists()).toBe(false)
    const fallback = wrapper.find('[data-testid="dm-drawer-avatar-fallback"]')
    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toBe('A')
  })

  it('renders channel profile link and badge when party is channel', () => {
    const wrapper = mountComponent({
      party: {
        type: 'channel',
        id: 'tech-news',
        display_name: 'Tech News',
      },
    })

    expect(wrapper.text()).toContain('Tech News')
    expect(wrapper.text()).toContain('频道')
    const channelLink = wrapper.find('a[href="/channels/tech-news"]')
    expect(channelLink.exists()).toBe(true)
  })

  it('emits block when clicking block button and conversation is not blocked', async () => {
    const wrapper = mountComponent({
      conversation: { ...mockConv, blocked: false },
    })

    const blockBtn = wrapper.find('[data-testid="dm-drawer-block-btn"]')
    expect(blockBtn.text()).toContain('拉黑')
    await blockBtn.trigger('click')

    expect(wrapper.emitted('block')).toHaveLength(1)
  })

  it('emits unblock when clicking block button and conversation is blocked', async () => {
    const wrapper = mountComponent({
      conversation: { ...mockConv, blocked: true },
    })

    const blockBtn = wrapper.find('[data-testid="dm-drawer-block-btn"]')
    expect(blockBtn.text()).toContain('取消拉黑')
    await blockBtn.trigger('click')

    expect(wrapper.emitted('unblock')).toHaveLength(1)
  })

  it('emits report when clicking report button', async () => {
    const wrapper = mountComponent()

    const reportBtn = wrapper.find('[data-testid="dm-drawer-report-btn"]')
    expect(reportBtn.exists()).toBe(true)
    await reportBtn.trigger('click')

    expect(wrapper.emitted('report')).toHaveLength(1)
  })

  it('emits close when clicking close button', async () => {
    const wrapper = mountComponent()

    const closeBtn = wrapper.find('[data-testid="dm-drawer-close-btn"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close when pressing Escape key and cleans up listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountComponent()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeEventListenerSpy.mockRestore()
  })
})
