import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BookReaderDisplayControls from '@/components/books/BookReaderDisplayControls.vue'

describe('BookReaderDisplayControls', () => {
  it('emits updated font scale and theme', async () => {
    const wrapper = mount(BookReaderDisplayControls, {
      props: { modelValue: { font_scale: 1, theme: 'paper' as const } },
    })

    await wrapper.get('select').setValue('1.15')
    await wrapper.get('[aria-label="夜间主题"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ font_scale: 1.15, theme: 'paper' }],
      [{ font_scale: 1, theme: 'night' }],
    ])
  })

  it('emits updated font family', async () => {
    const wrapper = mount(BookReaderDisplayControls, {
      props: { modelValue: { font_scale: 1, font_family: 'serif', theme: 'paper' as const } },
    })

    const fontSelect = wrapper.findAll('select')[1]
    await fontSelect.setValue('sans')

    expect(wrapper.emitted('update:modelValue')).toContainEqual([
      { font_scale: 1, font_family: 'sans', theme: 'paper' },
    ])
  })

  it('supports 4 paper themes: paper, sepia, slate, night', async () => {
    const wrapper = mount(BookReaderDisplayControls, {
      props: { modelValue: { font_scale: 1, theme: 'paper' as const } },
    })

    await wrapper.get('[aria-label="羊皮纸主题"]').trigger('click')
    await wrapper.get('[aria-label="雅灰主题"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toContainEqual([
      { font_scale: 1, theme: 'sepia' },
    ])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([
      { font_scale: 1, theme: 'slate' },
    ])
  })
})
