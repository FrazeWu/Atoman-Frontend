import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

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

  it('keeps a reply draft open on failure and closes it only after success', async () => {
    const onReply = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined)
    const wrapper = mount(CommentThread, { props: { root: makeComment('root'), authenticated: true, onReply } })
    await wrapper.get('[data-test="reply-comment"]').trigger('click')
    await wrapper.get('textarea').setValue('草稿内容')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await Promise.resolve()
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(true)
    expect(wrapper.get('textarea').element).toHaveValue('草稿内容')
    expect(wrapper.text()).toContain('回复失败')

    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(false))
  })

  it('passes existing mentions into the edit composer and preserves it on failure', async () => {
    const root = makeComment('root', { content: '你好 @alice', mentions: [{ user_id: 'user-1', start: 3, end: 9 }] })
    const onEdit = vi.fn().mockRejectedValue(new Error('failed'))
    const wrapper = mount(CommentThread, { props: { root, authenticated: true, currentUserId: 'user-1', onEdit } })
    await wrapper.get('button[title="编辑"]').trigger('click')
    expect(wrapper.findComponent({ name: 'CommentComposer' }).props('initialMentions')).toEqual(root.mentions)
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await Promise.resolve()
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('保存失败')
  })

  it('switches edit targets and does not close the new editor when an old save finishes', async () => {
    let resolveSave!: () => void
    const onEdit = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve }))
    const root = makeComment('root', { content: '根内容', reply_count: 1 })
    const child = makeComment('child', {
      root_id: 'root', content: '子内容 @alice',
      attachments: [{ id: 'asset-2', url: '/2.png', content_type: 'image/png', position: 0 }],
      mentions: [{ user_id: 'user-1', start: 4, end: 10 }],
    })
    const wrapper = mount(CommentThread, {
      props: { root, replies: [child], expanded: true, authenticated: true, currentUserId: 'user-1', onEdit },
    })
    const editButtons = wrapper.findAll('button[title="编辑"]')
    await editButtons[0].trigger('click')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    await editButtons[1].trigger('click')
    expect(wrapper.get('textarea').element).toHaveValue('子内容 @alice')
    expect(wrapper.findComponent({ name: 'CommentComposer' }).props('initialAttachmentIds')).toEqual(['asset-2'])
    expect(wrapper.findComponent({ name: 'CommentComposer' }).props('initialMentions')).toEqual(child.mentions)

    resolveSave()
    await Promise.resolve()
    expect(wrapper.findComponent({ name: 'CommentComposer' }).exists()).toBe(true)
    expect(wrapper.get('textarea').element).toHaveValue('子内容 @alice')
  })
})
