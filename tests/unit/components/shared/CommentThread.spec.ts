import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CommentThread from '@/components/shared/CommentThread.vue'

const items = [{
  id: 'c1',
  content: 'root',
  user: { username: 'alice' },
  created_at: '2026-07-07T00:00:00Z',
  replies: [{
    id: 'c2',
    content: 'hi',
    user: { username: 'bob' },
    reply_to_user: { username: 'alice' },
    created_at: '2026-07-07T00:01:00Z',
  }, {
    id: 'c3',
    content: '@bob second reply',
    user: { username: 'carol' },
    reply_to_user: { username: 'bob' },
    created_at: '2026-07-07T00:02:00Z',
  }],
}]

describe('CommentThread', () => {
  it('renders root comments and replies', () => {
    const wrapper = mount(CommentThread, { props: { items } })

    expect(wrapper.text()).toContain('root')
    expect(wrapper.text()).toContain('hi')
    expect(wrapper.text()).toContain('@bob second reply')
  })

  it('emits second-level comment id when replying to a reply', async () => {
    const wrapper = mount(CommentThread, {
      props: {
        items,
        canComment: true,
      },
    })

    const replyButtons = wrapper.findAll('.comment-thread__reply')
    await replyButtons[1].trigger('click')
    await wrapper.find('textarea').setValue('reply to reply')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'reply to reply', parentCommentId: 'c2' }])
  })

  it('shows reply_to_user mention when content does not include it', () => {
    const wrapper = mount(CommentThread, { props: { items } })

    expect(wrapper.text()).toContain('@alice')
  })
})
