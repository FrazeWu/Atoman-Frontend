import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationPopover from '@/components/system/NotificationPopover.vue'
import { useNotificationStore } from '@/stores/notification'
import { useInboxStore } from '@/stores/inbox'
import type { Notification } from '@/types'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="to" @click="$emit(\'click\', $event)"><slot /></a>',
  },
}))

describe('NotificationPopover', () => {
  let pinia: ReturnType<typeof createPinia>

  const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'notif-1',
    user_id: 'user-1',
    actor_id: 'actor-1',
    type: 'comment_reply',
    category: 'reply',
    source_type: 'blog_post',
    source_id: 'post-1',
    reason: '回复了你',
    created_at: new Date().toISOString(),
    read_at: null,
    actor: {
      id: 'actor-1',
      username: 'tester',
      display_name: '测试用户',
      avatar_url: '',
    },
    meta: {
      target_kind: 'blog_post',
      resource_id: 'post-1',
      root_id: 'comment-1',
    },
    ...overrides,
  })

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
  })

  it('renders recent notifications with NotificationItemCard and unread badge', () => {
    const notifStore = useNotificationStore()
    notifStore.notifications = [
      createMockNotification({ id: 'n1', reason: '通知一' }),
      createMockNotification({ id: 'n2', reason: '通知二', read_at: new Date().toISOString() }),
    ]
    notifStore.unreadCounts.reply = 1

    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    expect(wrapper.find('[data-test="popover-unread-badge"]').text()).toBe('1')
    const cards = wrapper.findAllComponents({ name: 'NotificationItemCard' })
    expect(cards).toHaveLength(2)
    expect(cards[0].props('compact')).toBe(true)
  })

  it('calls notificationStore.markAllRead when clicking 全部已读 button', async () => {
    const notifStore = useNotificationStore()
    notifStore.notifications = [createMockNotification({ id: 'n1' })]
    notifStore.unreadCounts.reply = 1
    const markAllReadSpy = vi.spyOn(notifStore, 'markAllRead').mockResolvedValue(undefined)

    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const markAllBtn = wrapper.find('[data-test="popover-mark-all"]')
    expect(markAllBtn.exists()).toBe(true)
    await markAllBtn.trigger('click')

    expect(markAllReadSpy).toHaveBeenCalled()
  })

  it('disables 全部已读 button when there are no unread notifications', () => {
    const notifStore = useNotificationStore()
    notifStore.notifications = [createMockNotification({ id: 'n1', read_at: '2026-01-01' })]

    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const markAllBtn = wrapper.find('[data-test="popover-mark-all"]')
    expect(markAllBtn.attributes('disabled')).toBeDefined()
  })

  it('marks notification as read, navigates, and emits close on item click', async () => {
    const notifStore = useNotificationStore()
    const item = createMockNotification({ id: 'n1' })
    notifStore.notifications = [item]
    notifStore.unreadCounts.reply = 1
    const markReadSpy = vi.spyOn(notifStore, 'markRead').mockResolvedValue(undefined)

    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const card = wrapper.findComponent({ name: 'NotificationItemCard' })
    await card.vm.$emit('click', 'n1')

    expect(markReadSpy).toHaveBeenCalledWith('n1')
    expect(mockPush).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('navigates and emits close when clicking footer links', async () => {
    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const allLink = wrapper.find('[data-test="footer-all"]')
    await allLink.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/inbox')
    expect(wrapper.emitted('close')).toBeTruthy()

    const dmLink = wrapper.find('[data-test="footer-dm"]')
    await dmLink.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/inbox?tab=dm')
  })

  it('renders clean empty state with icon when list is empty', () => {
    const notifStore = useNotificationStore()
    notifStore.notifications = []

    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const empty = wrapper.find('[data-test="popover-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('暂无未读通知')
    expect(empty.find('.popover-empty-icon').exists()).toBe(true)
  })

  it('renders footer links with arrow icons', () => {
    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    const arrows = wrapper.findAll('.popover-footer-arrow')
    expect(arrows.length).toBe(2)
  })

  it('automatically triggers fetchNotifications on mount', () => {
    const notifStore = useNotificationStore()
    const fetchSpy = vi.spyOn(notifStore, 'fetchNotifications').mockResolvedValue(undefined)

    mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith('all')
  })

  it('emits close on Escape keydown', async () => {
    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when global overlay opens for another module', async () => {
    const wrapper = mount(NotificationPopover, {
      global: {
        plugins: [pinia],
      },
    })

    window.dispatchEvent(new CustomEvent('atoman:global-overlay-open', { detail: 'user-menu' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
