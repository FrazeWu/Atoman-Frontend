import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessagesMobileView from '@/../apps/mobile/views/messages/MessagesMobileView.vue'
import MessageChatMobileView from '@/../apps/mobile/views/messages/MessageChatMobileView.vue'
import MessagesNotificationsView from '@/../apps/mobile/views/messages/MessagesNotificationsView.vue'
import MessagesMeView from '@/../apps/mobile/views/messages/MessagesMeView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useNotificationStore } from '@/stores/notification'
import type { DMConversation, DMMessage } from '@/api/dm'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ params: { id: 'c-real-1' }, query: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

describe('Messages Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
  })

  it('renders real conversations from dmStore in MessagesMobileView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'test-token'
    authStore.user = { id: 1, uuid: 'u-1', username: 'testuser', display_name: '测试用户', role: 'user' }

    const dmStore = useDMStore()
    const mockConv: DMConversation = {
      id: 'c-real-1',
      mailbox: { type: 'user', id: 'u-1', display_name: '测试用户', unread_count: 1 },
      other_party: { type: 'user', id: 'u-2', display_name: '李白', avatar_url: 'https://example.com/libai.png' },
      last_message_at: '2026-10-21T10:00:00Z',
      last_message_preview: '云想衣裳花想容，春风拂槛露华浓。',
      unread_count: 2,
      blocked: false,
      reply_as: { type: 'user', id: 'u-1', display_name: '测试用户' },
    }
    dmStore.conversationsById = { 'c-real-1': mockConv }
    dmStore.reconcileFromServer = vi.fn().mockResolvedValue(undefined)

    const wrapper = mount(MessagesMobileView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(dmStore.reconcileFromServer).toHaveBeenCalled()
    expect(wrapper.text()).toContain('李白')
    expect(wrapper.text()).toContain('云想衣裳花想容')
    expect(wrapper.text()).toContain('2')
  })

  it('opens conversation and sends message through dmStore in MessageChatMobileView', async () => {
    const dmStore = useDMStore()
    const testMsg: DMMessage = {
      id: 'm-1',
      conversation_id: 'c-real-1',
      client_message_id: 'client-1',
      sender: { type: 'user', id: 'u-2', display_name: '李白' },
      content: '君不见黄河之水天上来',
      created_at: '2026-10-21T10:00:00Z',
    }
    dmStore.messagesByConversation = { 'c-real-1': [testMsg] }
    dmStore.openConversation = vi.fn().mockResolvedValue(undefined)
    dmStore.sendActiveMessage = vi.fn().mockResolvedValue(undefined)

    const wrapper = mount(MessageChatMobileView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(dmStore.openConversation).toHaveBeenCalledWith('c-real-1')
    expect(wrapper.text()).toContain('君不见黄河之水天上来')

    const input = wrapper.find('input')
    await input.setValue('奔流到海不复回')
    const sendBtn = wrapper.find('[data-testid*="send-btn"]')
    await sendBtn.trigger('click')

    expect(dmStore.sendActiveMessage).toHaveBeenCalledWith('奔流到海不复回')
  })

  it('renders real notifications and marks all read in MessagesNotificationsView', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'test-token'
    const notifStore = useNotificationStore()
    notifStore.notifications = [
      {
        id: 'n-real-1',
        title: '杜甫 赞了你的短笺',
        category: 'like',
        content: '文章千古事，得失寸心知。',
        time: '5分钟前',
        read: false,
      },
    ] as any
    notifStore.markAllRead = vi.fn().mockResolvedValue(undefined)
    notifStore.fetchNotifications = vi.fn().mockResolvedValue(undefined)

    const wrapper = mount(MessagesNotificationsView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('杜甫 赞了你的短笺')
    expect(wrapper.text()).toContain('文章千古事')

    const markAllBtn = wrapper.find('[data-testid*="mark-read"]')
    expect(markAllBtn.exists()).toBe(true)
    await markAllBtn.trigger('click')

    expect(notifStore.markAllRead).toHaveBeenCalled()
  })

  it('renders MGuestCard in MessagesMeView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.user = null

    const wrapper = mount(MessagesMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
  })

  it('renders real store counters in MessagesMeView when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token-123'
    authStore.isAuthenticated = true
    authStore.user = { id: 1, uuid: 'u-1', username: 'libai', display_name: '李白', role: 'user' }

    const dmStore = useDMStore()
    dmStore.dmUnread = 3

    const notifStore = useNotificationStore()
    notifStore.unreadCounts.reply = 7

    const wrapper = mount(MessagesMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('7')
  })
})
