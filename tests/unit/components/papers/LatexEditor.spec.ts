import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LatexEditor from '@/components/papers/LatexEditor.vue'

describe('Papers LaTeX editor', () => {
  it('does not treat parent-provided content as a new user edit', async () => {
    const wrapper = mount(LatexEditor, { props: { modelValue: 'Initial draft' } })
    try {
      expect(wrapper.find('.cm-content').text()).toContain('Initial draft')
      await wrapper.setProps({ modelValue: 'Loaded chapter' })
      expect(wrapper.find('.cm-content').text()).toContain('Loaded chapter')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
})
