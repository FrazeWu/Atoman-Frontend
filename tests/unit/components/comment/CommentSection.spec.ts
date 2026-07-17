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
    await vi.waitFor(() => expect(state.load).toHaveBeenCalled())
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

  it('keeps a root draft after failure and resets it after success', async () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'alice', email: 'a@example.com', role: 'user' }
    auth.isAuthenticated = true
    state.create.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(makeComment('created'))
    const wrapper = mount(CommentSection, { props: { target: { kind: 'blog_post', resourceId: 'post' } } })
    await wrapper.get('textarea').setValue('根评论草稿')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await Promise.resolve()
    expect(wrapper.get('textarea').element).toHaveValue('根评论草稿')
    expect(wrapper.text()).toContain('发布失败')

    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('textarea').element).toHaveValue(''))
  })

  it('emits marked-change only after mark mutations succeed', async () => {
	state.mark.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'))
    state.unmark.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'))
	const wrapper = mount(CommentSection, { props: { target: { kind: 'forum_topic', resourceId: 'topic-1' } } })
	const thread = wrapper.findComponent({ name: 'CommentThread' })

	thread.vm.$emit('mark', 'root')
	await vi.waitFor(() => expect(wrapper.emitted('marked-change')).toEqual([[true]]))
	thread.vm.$emit('mark', 'root')
	await Promise.resolve()
	expect(wrapper.emitted('marked-change')).toEqual([[true]])
    thread.vm.$emit('unmark')
    await vi.waitFor(() => expect(wrapper.emitted('marked-change')).toEqual([[true], [false]]))
    thread.vm.$emit('unmark')
    await Promise.resolve()
    expect(wrapper.emitted('marked-change')).toEqual([[true], [false]])
  })

  it('keeps locked discussions readable without reply controls', async () => {
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-1', username: 'alice', email: 'a@example.com', role: 'user' }
    const wrapper = mount(CommentSection, { props: { target: { kind: 'forum_topic', resourceId: 'topic-1' }, readonly: true } })
    expect(wrapper.text()).toContain('该话题已锁定')
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'CommentThread' }).props('canReply')).toBe(false)
  })

  it('emits count changes after successful mutations only', async () => {
    state.target.value.comment_count = 1
    state.create.mockImplementationOnce(async () => { state.target.value.comment_count = 2 })
      .mockRejectedValueOnce(new Error('failed'))
    state.remove.mockImplementationOnce(async () => { state.target.value.comment_count = 1 })
      .mockRejectedValueOnce(new Error('failed'))
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-1', username: 'alice', email: 'a@example.com', role: 'user' }
    const wrapper = mount(CommentSection, { props: { target: { kind: 'forum_topic', resourceId: 'topic-1' } } })

    await wrapper.get('textarea').setValue('new')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('count-change')).toEqual([[2]]))
    await wrapper.findComponent({ name: 'CommentThread' }).vm.$emit('delete', 'root')
    await vi.waitFor(() => expect(wrapper.emitted('count-change')).toEqual([[2], [1]]))
    await wrapper.findComponent({ name: 'CommentThread' }).vm.$emit('delete', 'root')
    await Promise.resolve()
    expect(wrapper.emitted('count-change')).toEqual([[2], [1]])
  })

  it('loads root and reply pages before scrolling to a focused child', async () => {
    const firstRoot = makeComment('first-root')
    const targetRoot = makeComment('target-root', { reply_count: 2, replies: [] })
    const targetChild = makeComment('target-child', { root_id: targetRoot.id })
    const replyState = { expanded: false, page: 0, pageSize: 1, hasMore: true, loading: false }
    state.roots.value = [firstRoot]
    state.hasMore.value = true
    state.load.mockResolvedValue(undefined)
    state.loadMore.mockImplementation(async () => {
      state.roots.value.push(targetRoot)
      state.hasMore.value = false
    })
    state.replyState.mockImplementation(() => replyState)
    state.expandReplies.mockImplementation(async (_rootId: string, page: number) => {
      replyState.expanded = true
      replyState.page = page
      const loadedRoot = state.roots.value.find(({ id }) => id === targetRoot.id)!
      if (page === 1) {
        loadedRoot.replies.push(makeComment('other-child', { root_id: targetRoot.id }))
      } else {
        loadedRoot.replies.push(targetChild)
        replyState.hasMore = false
      }
    })
    const scrollIntoView = vi.fn()
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    const wrapper = mount(CommentSection, {
      props: {
        target: { kind: 'forum_topic', resourceId: 'topic-1' },
        focusCommentId: targetChild.id,
        focusRootId: targetRoot.id,
      },
    })

    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce())
    expect(state.loadMore).toHaveBeenCalledOnce()
    expect(state.expandReplies).toHaveBeenNthCalledWith(1, targetRoot.id, 1, 1)
    expect(state.expandReplies).toHaveBeenNthCalledWith(2, targetRoot.id, 2, 1)
    expect(wrapper.get(`#comment-${targetChild.id}`).exists()).toBe(true)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    wrapper.unmount()
  })

  it('expands replies when a focused child is loaded outside the preview', async () => {
    const targetChild = makeComment('preview-hidden-child', { root_id: 'root' })
    state.roots.value = [makeComment('root', {
      reply_count: 4,
      replies: [
        makeComment('child-1', { root_id: 'root' }),
        makeComment('child-2', { root_id: 'root' }),
        makeComment('child-3', { root_id: 'root' }),
        targetChild,
      ],
    })]
    state.hasMore.value = false
    state.load.mockResolvedValue(undefined)
    const replyState = { expanded: false, page: 0, pageSize: 20, hasMore: true, loading: false }
    state.replyState.mockImplementation(() => replyState)
    state.expandReplies.mockImplementation(async () => {
      replyState.expanded = true
      state.roots.value[0]!.replies = [...state.roots.value[0]!.replies]
    })
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    const wrapper = mount(CommentSection, { props: {
      target: { kind: 'forum_topic', resourceId: 'topic-1' },
      focusCommentId: targetChild.id,
      focusRootId: 'root',
    } })

    await vi.waitFor(() => expect(state.expandReplies).toHaveBeenCalledWith('root', 1, 20))
    await vi.waitFor(() => expect(wrapper.get(`#comment-${targetChild.id}`).exists()).toBe(true))
  })

  it('runs the latest focus after an older page load settles', async () => {
    let releaseLoad!: () => void
    const pendingLoad = new Promise<void>((resolve) => { releaseLoad = resolve })
    const nextRoot = makeComment('next-root')
    state.roots.value = [makeComment('first-root')]
    state.hasMore.value = true
    state.load.mockResolvedValue(undefined)
    state.loadMore.mockImplementation(async () => {
      if (state.loading.value) return
      state.loading.value = true
      await pendingLoad
      state.roots.value.push(nextRoot)
      state.hasMore.value = false
      state.loading.value = false
    })
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    const wrapper = mount(CommentSection, { props: {
      target: { kind: 'forum_topic', resourceId: 'topic-1' },
      focusCommentId: 'old-root', focusRootId: 'old-root',
    } })
    await vi.waitFor(() => expect(state.loadMore).toHaveBeenCalledOnce())
    await wrapper.setProps({ focusCommentId: nextRoot.id, focusRootId: nextRoot.id })
    await nextTick()
    releaseLoad()

    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce())
    expect(scrollIntoView.mock.instances[0]).toHaveProperty('id', `comment-${nextRoot.id}`)
  })

  it('falls back to the root when focused reply loading fails', async () => {
    const root = makeComment('fallback-root', { reply_count: 1, replies: [] })
    state.roots.value = [root]
    state.hasMore.value = false
    state.load.mockResolvedValue(undefined)
    state.replyState.mockReturnValue({ expanded: false, page: 0, pageSize: 20, hasMore: true, loading: false })
    state.expandReplies.mockRejectedValue(new Error('reply unavailable'))
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    mount(CommentSection, { props: {
      target: { kind: 'forum_topic', resourceId: 'topic-1' },
      focusCommentId: 'missing-child', focusRootId: root.id,
    } })

    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce())
    expect(scrollIntoView.mock.instances[0]).toHaveProperty('id', `comment-${root.id}`)
  })
})
