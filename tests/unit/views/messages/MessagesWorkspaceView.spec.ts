import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessagesWorkspaceView from '@/views/messages/MessagesWorkspaceView.vue'
import { useDMStore } from '@/stores/dm'
import type { DMConversation, DMMessage } from '@/api/dm'

let routeQuery: Record<string, string> = {}
const routerPush = vi.fn()
const routerReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery,
    fullPath: `/messages?${new URLSearchParams(routeQuery).toString()}`,
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
  },
}))

const mockConversation: DMConversation = {
  id: 'conv-1',
  mailbox: { type: 'user', id: 'me', display_name: 'Me', unread_count: 0 },
  other_party: { type: 'user', id: 'u1', display_name: 'Alice', avatar_url: '' },
  last_message_at: '2026-10-15T10:00:00Z',
  last_message_preview: '你好',
  unread_count: 0,
  blocked: false,
  reply_as: { type: 'user', id: 'me', display_name: 'Me' },
}

const mockMessage: DMMessage = {
  id: 'm1',
  client_message_id: 'client-1',
  conversation_id: 'conv-1',
  sender: { type: 'user', id: 'u1', display_name: 'Alice' },
  recipient: { type: 'user', id: 'me', display_name: 'Me' },
  content: '你好呀',
  created_at: '2026-10-15T10:00:00Z',
  read_at: null,
}

let pinia = createPinia()

describe('MessagesWorkspaceView', () => {
  beforeEach(() => {
    routeQuery = {}
    routerPush.mockReset()
    routerReplace.mockReset()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const mountView = (options = {}) => mount(MessagesWorkspaceView, {
    global: {
      plugins: [pinia],
    },
    ...options,
  })

  it('renders three-column layout structure', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="dm-workspace-layout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dm-conversation-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dm-mailbox-selector"]').exists()).toBe(true)
  })

  it('shows empty placeholder when no conversation is selected', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="dm-empty-placeholder"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('选择一个会话开始聊天')
    expect(wrapper.find('[data-testid="dm-conversation-pane"]').exists()).toBe(false)
  })

  it('opens conversation based on route.query.conversationId', async () => {
    routeQuery = { conversationId: 'conv-1' }
    const dmStore = useDMStore()
    const openSpy = vi.spyOn(dmStore, 'openConversation').mockResolvedValue()
    vi.spyOn(dmStore, 'bootstrapDM').mockImplementation(async () => {
      dmStore.reconcile({
        mailboxes: [{ type: 'user', id: 'me', display_name: 'Me', unread_count: 0 }],
        conversationsByMailbox: {
          'user:me': [mockConversation],
        },
        activeConversationId: '',
        activeMessages: [],
      })
    })

    const wrapper = mountView()
    await flushPromises()

    expect(openSpy).toHaveBeenCalledWith('conv-1')
  })

  it('opens target based on route.query.targetType and targetId', async () => {
    routeQuery = { targetType: 'user', targetId: 'u2' }
    const dmStore = useDMStore()
    const targetSpy = vi.spyOn(dmStore, 'openTarget').mockResolvedValue()
    vi.spyOn(dmStore, 'bootstrapDM').mockResolvedValue()

    const wrapper = mountView()
    await flushPromises()

    expect(targetSpy).toHaveBeenCalledWith({ type: 'user', id: 'u2' })
  })

  it('renders conversation pane and composer when a conversation is active', async () => {
    const dmStore = useDMStore()
    vi.spyOn(dmStore, 'bootstrapDM').mockResolvedValue()
    dmStore.reconcile({
      mailboxes: [{ type: 'user', id: 'me', display_name: 'Me', unread_count: 0 }],
      conversationsByMailbox: {
        'user:me': [mockConversation],
      },
      activeConversationId: 'conv-1',
      activeMessages: [mockMessage],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="dm-conversation-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dm-composer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dm-empty-placeholder"]').exists()).toBe(false)
  })

  it('toggles profile drawer when clicking drawer toggle button', async () => {
    const dmStore = useDMStore()
    vi.spyOn(dmStore, 'bootstrapDM').mockResolvedValue()
    dmStore.reconcile({
      mailboxes: [{ type: 'user', id: 'me', display_name: 'Me', unread_count: 0 }],
      conversationsByMailbox: {
        'user:me': [mockConversation],
      },
      activeConversationId: 'conv-1',
      activeMessages: [mockMessage],
    })

    const wrapper = mountView()
    await flushPromises()

    // Initially drawer is closed
    expect(wrapper.find('[data-testid="dm-profile-drawer"]').exists()).toBe(false)

    // Click toggle button in header
    const toggleBtn = wrapper.find('[data-testid="dm-toggle-drawer"]')
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Drawer is now open
    expect(wrapper.find('[data-testid="dm-profile-drawer"]').exists()).toBe(true)

    // Close drawer via close event
    const closeBtn = wrapper.find('[data-testid="dm-drawer-close-btn"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="dm-profile-drawer"]').exists()).toBe(false)
  })

  it('supports mobile back navigation to return to conversation list', async () => {
    const dmStore = useDMStore()
    vi.spyOn(dmStore, 'bootstrapDM').mockResolvedValue()
    dmStore.reconcile({
      mailboxes: [{ type: 'user', id: 'me', display_name: 'Me', unread_count: 0 }],
      conversationsByMailbox: {
        'user:me': [mockConversation],
      },
      activeConversationId: 'conv-1',
      activeMessages: [mockMessage],
    })

    const wrapper = mountView()
    await flushPromises()

    // Simulate mobile
    const vm = wrapper.vm as any
    vm.isMobile = true
    await wrapper.vm.$nextTick()

    const backBtn = wrapper.find('.dm-header-back-btn')
    expect(backBtn.exists()).toBe(true)
    await backBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Active conversation is deselected or mobile state returns to list
    expect(vm.mobileShowingConversation).toBe(false)
  })
})
