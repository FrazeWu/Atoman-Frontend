import { mount } from '@vue/test-utils'

import PTextarea from '@/components/ui/PTextarea.vue'

describe('PTextarea', () => {
  it('renders paper textarea affordances', () => {
    const wrapper = mount(PTextarea, {
      props: {
        modelValue: 'notes',
        label: '摘要',
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(true)
    expect(wrapper.find('textarea').classes()).toContain('p-textarea')
  })
})
