import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TimelineRevisionProposal from '@/components/timeline/TimelineRevisionProposal.vue'
import { timelineRevisionProposalApi } from '@/api/timelineRevisionProposals'
import { useAuthStore } from '@/stores/auth'
import { makeComment } from '../comment/fixtures'

vi.mock('@/api/timelineRevisionProposals', () => ({
  timelineRevisionProposalApi: { list: vi.fn(), create: vi.fn(), decide: vi.fn() },
}))

const proposal = { comment: makeComment('proposal-1'), target_kind: 'timeline_event', target_id: 'event-1', patch: { location: 'Berlin' }, evidence: 'archive', status: 'pending' }

describe('TimelineRevisionProposal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(timelineRevisionProposalApi.list).mockResolvedValue({ items: [proposal], page: 1, has_more: false })
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
    vi.mocked(timelineRevisionProposalApi.decide).mockResolvedValue({ ...proposal, status: 'accepted' })
    const wrapper = mount(TimelineRevisionProposal, { props: { targetKind: 'event', targetId: 'event-1', targetOwnerId: 'owner-1' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('archive'))
    expect(wrapper.findComponent({ name: 'CommentThread' }).exists()).toBe(true)
    await wrapper.get('[data-test="accept-proposal"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('已接受'))
    expect(wrapper.find('[data-test="reject-proposal"]').exists()).toBe(false)
  })
})
