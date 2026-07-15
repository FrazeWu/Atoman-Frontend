import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CommentThread from '@/components/comment/CommentThread.vue'
import { makeComment } from './fixtures'

describe('CommentThread', () => {
  it('renders every reply at one child depth', () => {
    const root = makeComment('root')
    const replies = [
      makeComment('child', { root_id: 'root' }),
      makeComment('nested', { root_id: 'root', reply_to_id: 'child' }),
    ]
    const wrapper = mount(CommentThread, { props: { root, replies, expanded: true } })
    expect(wrapper.findAll('[data-comment-depth="1"]')).toHaveLength(2)
    expect(wrapper.find('[data-comment-depth="2"]').exists()).toBe(false)
  })

  it('previews three replies and requests in-place expansion', async () => {
    const root = makeComment('root', { reply_count: 4 })
    const replies = Array.from({ length: 4 }, (_, index) => makeComment(`child-${index}`, { root_id: 'root' }))
    const wrapper = mount(CommentThread, { props: { root, replies, expanded: false } })
    expect(wrapper.findAll('[data-comment-depth="1"]')).toHaveLength(3)
    await wrapper.get('[data-test="expand-replies"]').trigger('click')
    expect(wrapper.emitted('expand')).toEqual([['root']])
  })

  it('renders a single marked label based on the authoritative target id', () => {
    const root = makeComment('root', { marked: true })
    const replies = [makeComment('child', { root_id: 'root', marked: true })]
    const wrapper = mount(CommentThread, {
      props: { root, replies, expanded: true, markedCommentId: 'root', markLabel: '最佳回答' },
    })
    expect(wrapper.findAll('[data-test="marked-label"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('最佳回答')
  })
})
