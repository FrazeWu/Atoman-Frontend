import { mount } from '@vue/test-utils'

import PTextarea from '@/components/ui/PTextarea.vue'

describe('PTextarea', () => {
  it('renders a standard labeled textarea without decorative markers', () => {
    const wrapper = mount(PTextarea, {
      props: {
        modelValue: 'notes',
        label: '摘要',
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(false)
    expect(wrapper.get('label').text()).toBe('摘要')
    expect(wrapper.find('textarea').classes()).toContain('p-textarea')
  })

  it('renders error state when error prop is provided', () => {
    const wrapper = mount(PTextarea, {
      props: {
        modelValue: '',
        label: '摘要',
        error: '描述不能为空',
      },
    })

    const textarea = wrapper.get('textarea')
    expect(textarea.classes()).toContain('p-textarea--error')

    const errorDiv = wrapper.find('.p-field-error')
    expect(errorDiv.exists()).toBe(true)
    expect(errorDiv.text()).toBe('描述不能为空')
  })
})
