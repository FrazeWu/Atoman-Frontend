import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NotificationItemCard from '@/components/notification/NotificationItemCard.vue'
import type { Notification } from '@/types'

const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-1',
  recipient_id: 'user-self',
  actor_id: 'actor-1',
  actor: {
    uuid: 'actor-1',
    username: 'alice',
    display_name: '爱丽丝',
    avatar_url: 'https://example.com/avatar.jpg',
    roles: [],
  },
  latest_actor: null,
  type: 'comment_reply',
  category: 'reply',
  reason: '在《测试文章》中回复了你',
  source_type: 'comment',
  source_id: 'c-100',
  actor_count: 1,
  meta: {
    reply_excerpt: '这是一条回复内容',
    source_label: '测试文章',
  },
  read_at: null,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ...overrides,
})

describe('NotificationItemCard', () => {
  it('renders reply notification with avatar, title, context quote, and time', () => {
    const notification = createMockNotification()
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    expect(wrapper.text()).toContain('爱丽丝 回复了你')
    expect(wrapper.text()).toContain('这是一条回复内容')
    expect(wrapper.text()).toContain('测试文章')
    expect(wrapper.text()).toContain('5 分钟前')
    expect(wrapper.find('[data-test="unread-dot"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="badge-reply"]').exists()).toBe(true)
  })

  it('renders like notification with like badge', () => {
    const notification = createMockNotification({
      id: 'notif-2',
      type: 'comment_like',
      category: 'like',
      meta: {
        like_count: 1,
        source_label: '测试文章',
      },
    })
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    expect(wrapper.text()).toContain('爱丽丝 赞了你')
    expect(wrapper.find('[data-test="badge-like"]').exists()).toBe(true)
  })

  it('renders mention notification with mention badge', () => {
    const notification = createMockNotification({
      id: 'notif-3',
      type: 'comment_mention',
      category: 'mention',
    })
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    expect(wrapper.text()).toContain('爱丽丝 提到了你')
    expect(wrapper.find('[data-test="badge-mention"]').exists()).toBe(true)
  })

  it('renders system notification with system badge', () => {
    const notification = createMockNotification({
      id: 'notif-4',
      type: 'site_announcement',
      category: 'system',
      actor: null,
      meta: {
        title: '系统维护公告',
        body: '今晚 12 点停机维护',
      },
    })
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    expect(wrapper.text()).toContain('系统维护公告')
    expect(wrapper.find('[data-test="badge-system"]').exists()).toBe(true)
  })

  it('hides unread dot when notification is read', () => {
    const notification = createMockNotification({
      read_at: '2026-10-14T10:00:00Z',
    })
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    expect(wrapper.find('[data-test="unread-dot"]').exists()).toBe(false)
  })

  it('emits click event with notification id when clicking card', async () => {
    const notification = createMockNotification()
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    await wrapper.find('.notification-item-card').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')![0]).toEqual(['notif-1'])
  })

  it('emits mark-read event when clicking mark-as-read button', async () => {
    const notification = createMockNotification()
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    const markReadBtn = wrapper.find('[data-test="action-mark-read"]')
    expect(markReadBtn.exists()).toBe(true)
    await markReadBtn.trigger('click')

    expect(wrapper.emitted('mark-read')).toBeTruthy()
    expect(wrapper.emitted('mark-read')![0]).toEqual(['notif-1'])
  })

  it('emits mute-type and mute-source events from dropdown actions', async () => {
    const notification = createMockNotification()
    const wrapper = mount(NotificationItemCard, {
      props: { notification },
    })

    const muteTypeBtn = wrapper.find('[data-test="action-mute-type"]')
    expect(muteTypeBtn.exists()).toBe(true)
    await muteTypeBtn.trigger('click')
    expect(wrapper.emitted('mute-type')).toBeTruthy()
    expect(wrapper.emitted('mute-type')![0]).toEqual([notification])

    const muteSourceBtn = wrapper.find('[data-test="action-mute-source"]')
    expect(muteSourceBtn.exists()).toBe(true)
    await muteSourceBtn.trigger('click')
    expect(wrapper.emitted('mute-source')).toBeTruthy()
    expect(wrapper.emitted('mute-source')![0]).toEqual([notification])
  })

  it('renders in compact mode without context quote or heavy actions', () => {
    const notification = createMockNotification()
    const wrapper = mount(NotificationItemCard, {
      props: { notification, compact: true },
    })

    expect(wrapper.classes()).toContain('notification-item-card--compact')
    expect(wrapper.find('[data-test="context-quote"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="action-mark-read"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="action-more"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="unread-dot"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('爱丽丝 回复了你')
  })
})
