import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TimelineRevisionProposal from '@/components/timeline/TimelineRevisionProposal.vue'
import { timelineRevisionProposalApi } from '@/api/timelineRevisionProposals'
import { commentApi } from '@/api/comments'
import { useAuthStore } from '@/stores/auth'
import { makeComment } from '../comment/fixtures'

vi.mock('@/api/timelineRevisionProposals', () => ({
  timelineRevisionProposalApi: { list: vi.fn(), create: vi.fn(), decide: vi.fn() },
}))
vi.mock('@/api/comments', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('@/api/comments')>()
  return { ...original, commentApi: { ...original.commentApi, listReplies: vi.fn(), create: vi.fn(), edit: vi.fn(), delete: vi.fn(), like: vi.fn(), unlike: vi.fn(), report: vi.fn() } }
})

const proposal = { comment: makeComment('proposal-1'), target_kind: 'timeline_event', target_id: 'event-1', patch: { location: 'Berlin' }, evidence: 'archive', status: 'pending' }

describe('TimelineRevisionProposal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(timelineRevisionProposalApi.list).mockResolvedValue({ items: [proposal], page: 1, per_page: 20, total: 1, has_more: false })
	vi.mocked(commentApi.listReplies).mockResolvedValue({ items: [], page: 1, per_page: 20, total: 0, has_more: false })
  })

  it('creates a typed proposal from changed fields and evidence', async () => {
    const auth = useAuthStore(); auth.isAuthenticated = true; auth.user = { uuid: 'user-1', username: 'u', email: 'u@example.com', role: 'user' }
    vi.mocked(timelineRevisionProposalApi.create).mockResolvedValue(proposal)
    const wrapper = mount(TimelineRevisionProposal, { props: { targetKind: 'event', targetId: 'event-1', targetOwnerId: 'owner-1' } })
    await vi.waitFor(() => expect(timelineRevisionProposalApi.list).toHaveBeenCalled())
    await wrapper.get('[data-test="proposal-field"]').setValue('location')
    await wrapper.get('[data-test="proposal-value"]').setValue('Berlin')
    await wrapper.get('[data-test="proposal-evidence"]').setValue('archive')
    await wrapper.get('textarea').setValue('修正地点')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await vi.waitFor(() => expect(timelineRevisionProposalApi.create).toHaveBeenCalledWith('event', 'event-1', expect.objectContaining({ content: '修正地点', evidence: 'archive', patch: { location: 'Berlin' } })))
  })

  it('shows decisions only to the target owner or moderator and synchronizes status', async () => {
    const auth = useAuthStore(); auth.isAuthenticated = true; auth.user = { uuid: 'owner-1', username: 'owner', email: 'o@example.com', role: 'user' }
    const accepted = { ...proposal, status: 'accepted' as const, comment: makeComment('proposal-1', { content: '接受后的完整提案' }) }
    vi.mocked(timelineRevisionProposalApi.decide).mockResolvedValue(accepted)
    const wrapper = mount(TimelineRevisionProposal, { props: { targetKind: 'event', targetId: 'event-1', targetOwnerId: 'owner-1' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('archive'))
    expect(wrapper.findComponent({ name: 'CommentThread' }).exists()).toBe(true)
    await wrapper.get('[data-test="accept-proposal"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('已接受'))
    expect(wrapper.find('[data-test="reject-proposal"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'CommentThread' }).props('root')).toMatchObject({ content: '接受后的完整提案', author: accepted.comment.author })
  })

  it('appends deduplicated root pages', async () => {
    const first = Array.from({ length: 20 }, (_, index) => ({ ...proposal, comment: makeComment(`root-${index}`) }))
    vi.mocked(timelineRevisionProposalApi.list)
      .mockResolvedValueOnce({ items: first, page: 1, per_page: 20, total: 21, has_more: true })
      .mockResolvedValueOnce({ items: [{ ...proposal, comment: makeComment('root-19') }, { ...proposal, comment: makeComment('root-20') }], page: 2, per_page: 20, total: 21, has_more: false })
    const wrapper = mount(TimelineRevisionProposal, { props: { targetKind: 'event', targetId: 'event-1', targetOwnerId: 'owner-1' } })
    await vi.waitFor(() => expect(wrapper.findAllComponents({ name: 'CommentThread' })).toHaveLength(20))
    await wrapper.get('[data-test="load-more-proposals"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAllComponents({ name: 'CommentThread' })).toHaveLength(21))
  })

  it('keeps all loaded replies expanded after a reply mutation', async () => {
    const replies = Array.from({ length: 4 }, (_, index) => makeComment(`reply-${index}`, { root_id: 'proposal-1' }))
    const rootWithPreview = { ...proposal, comment: makeComment('proposal-1', { reply_count: 4, replies: replies.slice(0, 3) }) }
    vi.mocked(timelineRevisionProposalApi.list).mockResolvedValue({ items: [rootWithPreview], page: 1, per_page: 20, total: 1, has_more: false })
    vi.mocked(commentApi.listReplies).mockResolvedValue({ items: replies, page: 1, per_page: 20, total: 4, has_more: false })
    vi.mocked(commentApi.create).mockResolvedValue(makeComment('new-reply', { root_id: 'proposal-1' }))
    const wrapper = mount(TimelineRevisionProposal, { props: { targetKind: 'event', targetId: 'event-1', targetOwnerId: 'owner-1' } })
    await vi.waitFor(() => expect(wrapper.find('[data-test="expand-replies"]').exists()).toBe(true))
    await wrapper.get('[data-test="expand-replies"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-comment-depth="1"]')).toHaveLength(4))
    const thread = wrapper.findComponent({ name: 'CommentThread' })
    await thread.props('onReply')(thread.props('root'), { content: 'new', mentions: [], attachment_ids: [] })
    await vi.waitFor(() => expect(wrapper.findAll('[data-comment-depth="1"]')).toHaveLength(4))
    expect(wrapper.findComponent({ name: 'CommentThread' }).props('expanded')).toBe(true)
  })
})
