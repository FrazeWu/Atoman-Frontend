import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CommentComposer from '@/components/comment/CommentComposer.vue'
import { commentApi } from '@/api/comments'
import * as mentions from '@/composables/useCommentMentions'

describe('CommentComposer', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('counts Unicode code points and rejects content beyond 2,000', async () => {
    const wrapper = mount(CommentComposer)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('😀'.repeat(2001))
    expect(wrapper.text()).toContain('超过 2000 字')
    expect(wrapper.get('[data-test="comment-submit"]').attributes('disabled')).toBeDefined()

    await textarea.setValue('😀'.repeat(2000))
    expect(wrapper.text()).not.toContain('超过 2000 字')
    expect(wrapper.get('[data-test="comment-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('allows image-only submission and uploads at most four images', async () => {
    vi.spyOn(commentApi, 'uploadImage').mockImplementation(async (file) => `asset-${file.name}`)
    const wrapper = mount(CommentComposer)
    const input = wrapper.get('input[type="file"]')
    const files = Array.from({ length: 5 }, (_, index) => new File(['x'], `${index + 1}.png`, { type: 'image/png' }))
    Object.defineProperty(input.element, 'files', { configurable: true, value: files })
    await input.trigger('change')
    await vi.waitFor(() => expect(commentApi.uploadImage).toHaveBeenCalledTimes(4))
    await vi.waitFor(() => expect(wrapper.get('[data-test="comment-submit"]').attributes('disabled')).toBeUndefined())
    expect(wrapper.text()).toContain('最多上传 4 张图片')

    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      content: '',
      mentions: [],
      attachment_ids: ['asset-1.png', 'asset-2.png', 'asset-3.png', 'asset-4.png'],
    })
  })

  it('emits selected mentions as Unicode code-point ranges', async () => {
    vi.spyOn(mentions, 'searchMentionUsers').mockResolvedValue([{
      uuid: 'user-2', username: 'alicia', display_name: 'Alicia', avatar_url: '', role: 'user',
    }])
    const wrapper = mount(CommentComposer)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('😀 @ali')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(7, 7)
    await textarea.trigger('keyup')
    await vi.waitFor(() => expect(wrapper.find('[data-test="mention-option"]').exists()).toBe(true))
    await wrapper.get('[data-test="mention-option"]').trigger('click')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      content: '😀 @alicia',
      mentions: [{ user_id: 'user-2', start: 2, end: 9 }],
      attachment_ids: [],
    })
  })

  it('inserts the current media time without adding a time payload', async () => {
    const wrapper = mount(CommentComposer, { props: { currentTime: () => 65 } })
    await wrapper.get('[data-test="insert-current-time"]').trigger('click')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ content: '1:05', mentions: [], attachment_ids: [] })
  })

  it('preserves initial structured mentions when editing unchanged text', async () => {
    const wrapper = mount(CommentComposer, { props: {
      initialContent: '你好 @alice', initialMentions: [{ user_id: 'user-1', start: 3, end: 9 }],
    } })
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      content: '你好 @alice', mentions: [{ user_id: 'user-1', start: 3, end: 9 }],
    })
  })

  it('recalculates repeated mentions once per token without duplicate ranges', async () => {
    const wrapper = mount(CommentComposer, { props: {
      initialContent: '@alice 和 @alice',
      initialMentions: [
        { user_id: 'user-1', start: 0, end: 6 },
        { user_id: 'user-1', start: 9, end: 15 },
      ],
    } })
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      mentions: [
        { user_id: 'user-1', start: 0, end: 6 },
        { user_id: 'user-1', start: 9, end: 15 },
      ],
    })
  })

  it('ignores a late mention search after the query is no longer active', async () => {
    let resolveSearch!: (users: mentions.MentionSearchUser[]) => void
    vi.spyOn(mentions, 'searchMentionUsers').mockReturnValue(new Promise((resolve) => { resolveSearch = resolve }))
    const wrapper = mount(CommentComposer)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('@ali')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(4, 4)
    await textarea.trigger('keyup')
    await textarea.setValue('普通正文')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(4, 4)
    await textarea.trigger('keyup')
    resolveSearch([{ uuid: 'late', username: 'alice', display_name: 'Alice', avatar_url: '', role: 'user' }])
    await Promise.resolve()
    expect(wrapper.find('[data-test="mention-option"]').exists()).toBe(false)
  })
})
