import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InboxPage from '@/views/feed/InboxPage.vue'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'
import type { Notification } from '@/types'

const makeNotification = (overrides: Partial<Notification>): Notification => ({
  id: 'notice-1',
  recipient_id: 'user-1',
  actor_id: 'user-2',
  actor: { username: 'alice', email: 'alice@example.com' },
  type: 'forum_reply',
  source_type: 'forum_reply',
  source_id: 'reply-1',
  meta: {
    topic_id: 'topic-1',
    topic_title: '通知跳转',
    reply_excerpt: '回复内容',
  },
  read_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const mountInbox = async (notification: Notification) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.token = 'token'
  authStore.isAuthenticated = true
  authStore.user = { username: 'fafa', email: 'fafa@example.com' }

  const inboxStore = useInboxStore()
  vi.spyOn(inboxStore, 'bootstrap').mockResolvedValue(undefined)

  const notificationStore = useNotificationStore()
  notificationStore.notifications = [notification]
  vi.spyOn(notificationStore, 'fetchNotifications').mockResolvedValue(undefined)
  vi.spyOn(notificationStore, 'markRead').mockResolvedValue(undefined)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed/inbox', component: { template: '<div />' } },
      { path: '/forum/topic/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/feed/inbox')
  await router.isReady()
  const pushSpy = vi.spyOn(router, 'push')
  pushSpy.mockResolvedValue(undefined)

  const wrapper = mount(InboxPage, {
    global: {
      plugins: [pinia, router],
      stubs: {
        PButton: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        PEmpty: { template: '<div />' },
        PPress: { template: '<button />' },
        PTab: { template: '<button />' },
        PBadge: { template: '<span><slot /></span>' },
        PTextarea: { template: '<textarea />' },
      },
    },
  })

  await flushPromises()
  pushSpy.mockClear()
  return { wrapper, pushSpy }
}

describe('InboxPage forum 通知跳转', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('回复通知跳转到 /forum/topic/:id 的回复锚点', async () => {
    const { wrapper, pushSpy } = await mountInbox(makeNotification({}))

    await wrapper.findAll('button').find((button) => button.text().includes('前往来源内容'))!.trigger('click')

    expect(pushSpy).toHaveBeenLastCalledWith('/forum/topic/topic-1#reply-reply-1')
  })

  it('话题通知跳转到 /forum/topic/:id', async () => {
    const { wrapper, pushSpy } = await mountInbox(makeNotification({
      id: 'notice-2',
      source_type: 'forum_topic',
      source_id: 'topic-2',
      meta: { topic_title: '新话题' },
    }))

    await wrapper.findAll('button').find((button) => button.text().includes('前往来源内容'))!.trigger('click')

    expect(pushSpy).toHaveBeenLastCalledWith('/forum/topic/topic-2')
  })

  it('统一评论通知优先按目标类型跳转并保留评论定位', async () => {
    const { wrapper, pushSpy } = await mountInbox(makeNotification({
      id: 'notice-comment',
      type: 'comment_mention',
      source_type: 'comment',
      source_id: 'child-1',
      meta: {
        target_kind: 'video', resource_id: 'video-1', comment_id: 'child-1', root_id: 'root-1',
      },
    }))

    await wrapper.findAll('button').find((button) => button.text().includes('前往来源内容'))!.trigger('click')

    expect(pushSpy).toHaveBeenLastCalledWith({
      path: '/videos/videos/watch/video-1', query: { comment_id: 'child-1' }, hash: '#comment-root-1',
    })
    expect(wrapper.text()).not.toContain('child-1')
  })

  it('回复标签同时请求旧回复、新回复和标记通知', async () => {
    const { wrapper } = await mountInbox(makeNotification({}))
    const store = useNotificationStore()
    expect(store.fetchNotifications).toHaveBeenCalledWith(['forum_reply', 'forum_solved', 'comment_reply', 'comment_marked'], 1)
    wrapper.unmount()
  })
})
