import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InboxPage from '@/views/feed/InboxPage.vue'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'

let routeQuery: Record<string, string> = { tab: 'collaboration' }
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery, fullPath: `/inbox?tab=${routeQuery.tab || ''}` }),
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}))

describe('InboxPage notifications', () => {
  beforeEach(() => {
    routeQuery = { tab: 'collaboration' }
    routerPush.mockReset()
    setActivePinia(createPinia())
  })

  const stubs = {
    PTab: { props: ['label'], template: '<button>{{ label }}</button>' },
    PButton: { template: '<button><slot /></button>' },
    PEmpty: { props: ['title', 'description'], template: '<div>{{ title }}{{ description }}</div>' },
    PTextarea: { props: ['placeholder'], template: '<textarea :placeholder="placeholder" />' },
    PPress: { props: ['label'], template: '<button>{{ label }}</button>' },
    PBadge: { template: '<span><slot /></span>' },
  }

  it('renders fixed notification categories without all tab', async () => {
    const wrapper = mount(InboxPage, { global: { stubs } })
    expect(wrapper.text()).toContain('点赞')
    expect(wrapper.text()).toContain('互动')
    expect(wrapper.text()).toContain('协作')
    expect(wrapper.text()).not.toContain('全部')
  })

  it('uses a unified inbox workspace with side category navigation', () => {
    const wrapper = mount(InboxPage, { global: { stubs } })
    const shell = wrapper.find('.inbox-shell')

    expect(shell.exists()).toBe(true)
    expect(shell.find('.inbox-category-pane').exists()).toBe(true)
    expect(shell.find('.inbox-tabs').exists()).toBe(false)
    expect(shell.find('.inbox-body').exists()).toBe(true)
  })

  it('shows notification reason in detail pane', async () => {
    const store = useNotificationStore()
    store.notifications = [{
      id: 'n1',
      recipient_id: 'u1',
      type: 'collaboration.required',
      category: 'collaboration',
      reason: '因为歌词修改影响了你的注释',
      source_type: 'music_lyrics',
      source_id: 's1',
      actor_count: 1,
      meta: { title: '歌词修改影响了你的注释绑定', body: '需要重新绑定' },
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    }]
    const wrapper = mount(InboxPage, { global: { stubs } })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('因为歌词修改影响了你的注释')
  })

  it('将歌词重绑通知跳转到专辑并携带歌曲和注释焦点', async () => {
    const store = useNotificationStore()
    store.notifications = [{
      id: 'n-lyrics', recipient_id: 'u1', type: 'collaboration.required', category: 'collaboration',
      reason: '歌词需要重新绑定', source_type: 'music_lyrics', source_id: 'annotation-1', actor_count: 1,
      meta: { album_id: 'album-1', song_id: 'song-1', annotation_id: 'annotation-1' },
      created_at: '2026-07-07T00:00:00Z', updated_at: '2026-07-07T00:00:00Z',
    }]
    const wrapper = mount(InboxPage, { global: { stubs } })
    await wrapper.vm.$nextTick()
    await wrapper.get('.sidebar-item').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('.detail-actions button').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/music/album/album-1',
      query: { song_id: 'song-1', annotation_id: 'annotation-1', rebind: '1' },
    })
  })

  it('shows notification source label in list and detail panes', async () => {
    routeQuery = { tab: 'like' }
    const store = useNotificationStore()
    store.notifications = [{
      id: 'n-source',
      recipient_id: 'u1',
      type: 'content.liked',
      category: 'like',
      reason: '有人赞了你的内容',
      source_type: 'forum_topic',
      source_id: 'topic-1',
      actor_count: 1,
      meta: { title: '有人赞了你的内容', source_label: '测试通知来源：点赞' },
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    }]

    const wrapper = mount(InboxPage, { global: { stubs } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.sidebar-item-source').text()).toBe('测试通知来源：点赞')
    await wrapper.find('.sidebar-item').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.detail-source').text()).toBe('测试通知来源：点赞')
  })

  it('disables dm composer for blocked conversation', () => {
    routeQuery = { tab: 'dm' }
    const dm = useDMStore()
    dm.conversations = [{ conversation_id: 'c1', other_username: 'alice', other_user_id: 'u1', preview: '', unread_count: 0, is_blocked: true }]
    dm.activeConversation = 'alice'
    const wrapper = mount(InboxPage, { global: { stubs } })
    expect(wrapper.text()).toContain('已拉黑此用户')
  })
})
