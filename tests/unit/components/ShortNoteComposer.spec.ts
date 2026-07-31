import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'

describe('ShortNoteComposer', () => {
  it('shows the 500-character limit and an image picker', () => {
    const wrapper = mount(ShortNoteComposer, { global: { plugins: [createPinia()] } })

    expect(wrapper.text()).toContain('0/500')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('image/')
  })
})
