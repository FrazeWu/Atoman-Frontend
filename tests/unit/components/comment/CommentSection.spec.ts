import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import CommentSection from '@/components/comment/CommentSection.vue'
import { useAuthStore } from '@/stores/auth'
import { makeComment } from './fixtures'

const state = {
  roots: ref([makeComment('root')]),
  target: ref({ kind: 'blog_post', resource_id: 'post', mark_label: '置顶', can_mark: true, marked_comment_id: null, comment_count: 1, root_count: 1 }),
  sort: ref<'oldest' | 'newest' | 'hot'>('oldest'), page: ref(1), pageSize: ref(20), loading: ref(false), error: ref(null), hasMore: ref(false),
  isLikePending: vi.fn(() => ref(false)), replyState: vi.fn(() => ({ expanded: false, loading: false, hasMore: false })),
  load: vi.fn(), loadMore: vi.fn(), setSort: vi.fn(), expandReplies: vi.fn(), create: vi.fn(), edit: vi.fn(), remove: vi.fn(),
  toggleLike: vi.fn(), report: vi.fn(), mark: vi.fn(), unmark: vi.fn(),
}

vi.mock('@/composables/useComments', () => ({ useComments: () => state }))

describe('CommentSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    state.target.value = { kind: 'blog_post', resource_id: 'post', mark_label: '置顶', can_mark: true, marked_comment_id: null, comment_count: 1, root_count: 1 }
  })

  it('shows a login action to guests and the composer to signed-in users', async () => {
    const wrapper = mount(CommentSection, { props: { target: { kind: 'blog_post', resourceId: 'post' } } })
    expect(wrapper.text()).toContain('登录后评论')
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(false)

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'alice', email: 'a@example.com', role: 'user' }
    auth.isAuthenticated = true
    await nextTick()
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(true)
  })

  it('loads the target and forwards media seek events', async () => {
    const wrapper = mount(CommentSection, { props: { target: { kind: 'video', resourceId: 'video-1' } } })
    expect(state.load).toHaveBeenCalled()
    wrapper.findComponent({ name: 'CommentThread' }).vm.$emit('seek', 65)
    expect(wrapper.emitted('seek')).toEqual([[65]])
  })

  it('uses the server mark label and grants target-owner deletion', async () => {
    state.target.value = { ...state.target.value, mark_label: '最佳回答', can_mark: true }
    const wrapper = mount(CommentSection, { props: { target: { kind: 'forum_topic', resourceId: 'topic-1' } } })
    await nextTick()
    const thread = wrapper.findComponent({ name: 'CommentThread' })
    expect(thread.props('markLabel')).toBe('最佳回答')
    expect(thread.props('canDelete')).toBe(true)
  })
})
