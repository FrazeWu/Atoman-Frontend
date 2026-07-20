import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PReferenceField from '@/components/shared/PReferenceField.vue'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(async (type: string) => type === 'post' ? [{
      type: 'post', id: 'post-1', label: 'Design Notes', module: 'blog', path: '/post/post-1', available: true,
    }] : []),
  },
}))

describe('PReferenceField', () => {
  it('opens root suggestions from the visible reference button', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PReferenceField, { props: { modelValue: '' } })
    const button = wrapper.get('[data-test="reference-trigger"]')
    expect(button.attributes('aria-label')).toBe('添加引用')
    expect(button.attributes('title')).toBe('添加引用')

    await button.trigger('click')
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()

    expect(wrapper.get('input').element.value).toBe('@')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('replaces a resource search with its canonical token', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PReferenceField, { props: { modelValue: '', variant: 'textarea' } })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('See @post:design')
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1)
    await wrapper.get('[role="option"]').trigger('mousedown')
    const updates = wrapper.emitted('update:modelValue') as Array<[string]>
    expect(updates.at(-1)?.[0]).toBe('See @post:post-1')
    vi.useRealTimers()
  })
})
