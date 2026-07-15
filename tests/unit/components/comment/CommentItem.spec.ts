import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CommentItem from '@/components/comment/CommentItem.vue'
import { makeComment } from './fixtures'

describe('CommentItem', () => {
  it('shows the exact edited timestamp', () => {
    const editedAt = '2026-07-15T09:12:34.567Z'
    const wrapper = mount(CommentItem, { props: { comment: makeComment('root', { edited_at: editedAt }) } })
    expect(wrapper.get('time[data-test="edited-at"]').attributes('datetime')).toBe(editedAt)
    expect(wrapper.get('time[data-test="edited-at"]').attributes('title')).toBe(editedAt)
  })

  it('folds auto-reported content until explicitly revealed', async () => {
    const wrapper = mount(CommentItem, { props: { comment: makeComment('root', { status: 'auto_folded' }) } })
    expect(wrapper.text()).toContain('因多次举报已折叠')
    expect(wrapper.find('[data-test="comment-content"]').exists()).toBe(false)
    await wrapper.get('[data-test="reveal-comment"]').trigger('click')
    expect(wrapper.find('[data-test="comment-content"]').exists()).toBe(true)
  })

  it('emits seek from a server-provided time anchor', async () => {
    const wrapper = mount(CommentItem, { props: { comment: makeComment('root', {
      content: '跳到 1:05', rendered_html: '<p>跳到 1:05</p>',
      time_anchors: [{ start: 3, end: 7, seconds: 65 }],
    }) } })
    await wrapper.get('[data-test="time-anchor"]').trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[65]])
  })

  it('only shows interaction actions for authenticated users', () => {
    const anonymous = mount(CommentItem, { props: { comment: makeComment('root'), authenticated: false } })
    expect(anonymous.find('[data-test="reply-comment"]').exists()).toBe(false)
    const signedIn = mount(CommentItem, { props: { comment: makeComment('root'), authenticated: true } })
    expect(signedIn.find('[data-test="reply-comment"]').exists()).toBe(true)
  })
})
