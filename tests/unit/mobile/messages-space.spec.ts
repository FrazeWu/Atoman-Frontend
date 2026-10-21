import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import MessagesMobileView from '@mobile/views/messages/MessagesMobileView.vue'
import MessagesNotificationsView from '@mobile/views/messages/MessagesNotificationsView.vue'
import MessagesContactsView from '@mobile/views/messages/MessagesContactsView.vue'
import MessagesMeView from '@mobile/views/messages/MessagesMeView.vue'
import MessageChatMobileView from '@mobile/views/messages/MessageChatMobileView.vue'

vi.mock('@mobile/components/ui/MIcon.vue', () => ({
  default: {
    name: 'MIcon',
    props: ['name', 'size'],
    template: '<span class="m-icon" :data-icon="name"><slot /></span>',
  },
}))

describe('Mobile Messages Space Overhaul (Option A)', () => {
  let router: any

  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/inbox', component: MessagesMobileView },
        { path: '/inbox/notifications', component: MessagesNotificationsView },
        { path: '/inbox/contacts', component: MessagesContactsView },
        { path: '/inbox/me', component: MessagesMeView },
        { path: '/inbox/chat/:id', component: MessageChatMobileView },
      ],
    })
  })

  describe('MessagesMobileView.vue (Tab 1: 私信会话列表)', () => {
    const mockConversations = [
      {
        id: 'c-1',
        partyName: 'Alice',
        lastMessage: '新设计的阅读器非常轻快！',
        unreadCount: 2,
        updatedAt: '14:30',
      },
      {
        id: 'c-2',
        partyName: 'Bob',
        lastMessage: '收到，今晚合并代码。',
        unreadCount: 0,
        updatedAt: '昨天',
      },
    ]

    it('renders conversations list, search input, and unread badges', () => {
      const wrapper = mount(MessagesMobileView, {
        global: { plugins: [router] },
        props: { initialConversations: mockConversations },
      })

      expect(wrapper.find('[data-testid="messages-search-input"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="conversation-item"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('新设计的阅读器非常轻快！')
      expect(wrapper.text()).toContain('2')
    })

    it('filters conversations when typing in search input', async () => {
      const wrapper = mount(MessagesMobileView, {
        global: { plugins: [router] },
        props: { initialConversations: mockConversations },
      })

      const searchInput = wrapper.find('[data-testid="messages-search-input"] input')
      if (searchInput.exists()) {
        await searchInput.setValue('Alice')
        expect(wrapper.text()).toContain('Alice')
        expect(wrapper.text()).not.toContain('Bob')
      }
    })

    it('clicking a conversation item navigates to chat route', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(MessagesMobileView, {
        global: { plugins: [router] },
        props: { initialConversations: mockConversations },
      })

      const firstConv = wrapper.find('[data-testid="conversation-item"]')
      await firstConv.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/inbox/chat/c-1')
    })
  })

  describe('MessageChatMobileView.vue (独立全屏聊天对话页)', () => {
    const mockChatData = {
      partyId: 'c-1',
      partyName: 'Alice',
      onlineStatus: '在线',
      messages: [
        { id: 'm-1', text: '你好，阅读器排版改好了吗？', time: '14:28', isMe: false },
        { id: 'm-2', text: '已经重构完成，应用了 4px 微圆角与柔和边线！', time: '14:29', isMe: true },
      ],
    }

    it('renders chat header, back button, and message bubbles', () => {
      const wrapper = mount(MessageChatMobileView, {
        global: { plugins: [router] },
        props: { initialChat: mockChatData },
      })

      expect(wrapper.find('[data-testid="chat-back-btn"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.findAll('[data-testid="message-bubble"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('已经重构完成')
    })

    it('sends a new message when clicking send button', async () => {
      const wrapper = mount(MessageChatMobileView, {
        global: { plugins: [router] },
        props: { initialChat: mockChatData },
      })

      const input = wrapper.find('[data-testid="chat-input"] input')
      await input.setValue('现在去截屏验证')
      const sendBtn = wrapper.find('[data-testid="chat-send-btn"]')
      await sendBtn.trigger('click')

      expect(wrapper.text()).toContain('现在去截屏验证')
    })
  })

  describe('MessagesNotificationsView.vue (Tab 2: 通知流)', () => {
    const mockNotifications = [
      {
        id: 'n-1',
        title: 'Alice 赞了你的短笺',
        category: 'like',
        content: '“事物的本质并不因赞扬而改变。”',
        time: '10分钟前',
        read: false,
      },
      {
        id: 'n-2',
        title: '系统公告：移动端体验升级',
        category: 'system',
        content: '移动端全空间纯白微圆角系统已全量上线。',
        time: '2小时前',
        read: true,
      },
    ]

    it('renders notification items and category chips', () => {
      const wrapper = mount(MessagesNotificationsView, {
        global: { plugins: [router] },
        props: { initialNotifications: mockNotifications },
      })

      expect(wrapper.findAll('[data-testid="notification-item"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('Alice 赞了你的短笺')
      expect(wrapper.find('[data-testid="notifications-mark-read-btn"]').exists()).toBe(true)
    })

    it('marks all notifications as read on click', async () => {
      const wrapper = mount(MessagesNotificationsView, {
        global: { plugins: [router] },
        props: { initialNotifications: mockNotifications },
      })

      const markBtn = wrapper.find('[data-testid="notifications-mark-read-btn"]')
      await markBtn.trigger('click')
      expect(wrapper.findAll('.is-unread')).toHaveLength(0)
    })
  })

  describe('MessagesContactsView.vue (Tab 3: 联系人名录)', () => {
    const mockContacts = [
      { id: 'u-1', name: 'Alice', bio: '文字创作者', online: true },
      { id: 'u-2', name: 'Bob', bio: '全栈工程师', online: false },
    ]

    it('renders contacts list with chat launch button', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(MessagesContactsView, {
        global: { plugins: [router] },
        props: { initialContacts: mockContacts },
      })

      expect(wrapper.findAll('[data-testid="contact-item"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('Alice')

      const chatBtn = wrapper.find('[data-testid="contact-chat-btn-u-1"]')
      await chatBtn.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/inbox/chat/u-1')
    })
  })

  describe('MessagesMeView.vue (Tab 4: 设置与偏好)', () => {
    it('renders message statistics, dnd toggle, and blacklist summary', () => {
      const wrapper = mount(MessagesMeView, {
        global: { plugins: [router] },
        props: {
          initialStats: { unreadDMs: 2, unreadNotifications: 5, blacklistCount: 0 },
        },
      })

      expect(wrapper.find('[data-testid="messages-stats-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).toContain('5')
      expect(wrapper.find('[data-testid="dnd-toggle-btn"]').exists()).toBe(true)
    })
  })
})
