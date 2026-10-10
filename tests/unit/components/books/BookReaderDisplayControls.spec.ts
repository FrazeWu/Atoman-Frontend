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
})
