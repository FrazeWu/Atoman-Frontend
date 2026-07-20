import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import CommentComposer from '@/components/comment/CommentComposer.vue'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(async (type: string) => type === 'post' ? [{
      type: 'post', id: 'post-1', label: 'Design Notes', module: 'blog', path: '/post/post-1', available: true,
    }] : []),
  },
}))

vi.mock('@/api/comments', () => ({
  commentApi: { uploadImage: vi.fn() },
}))

describe('CommentComposer references', () => {
  it('opens root suggestions from the reference tool', async () => {
    vi.useFakeTimers()
    const wrapper = mount(CommentComposer)
    const button = wrapper.get('[data-test="reference-trigger"]')
    expect(button.attributes('aria-label')).toBe('添加引用')

    await button.trigger('click')
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()

    expect(wrapper.get('textarea').element.value).toBe('@')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('inserts a resource token without adding a client mention range', async () => {
    vi.useFakeTimers()
    const wrapper = mount(CommentComposer)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('See @post:design')
    await textarea.trigger('keyup')
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()
    await wrapper.get('[role="option"]').trigger('mousedown')
    await wrapper.get('[data-test="comment-submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      content: 'See @post:post-1',
      mentions: [],
    })
    vi.useRealTimers()
  })
})
