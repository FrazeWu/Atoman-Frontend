import { mount } from '@vue/test-utils'

import PInput from '@/components/ui/PInput.vue'

describe('PInput', () => {
  it('associates label text with the input control', () => {
    const wrapper = mount(PInput, {
      props: {
        modelValue: '',
        label: '通行密码',
      },
      attrs: {
        type: 'password',
      },
    })

    const label = wrapper.get('label')
    const input = wrapper.get('input')
    const inputId = input.attributes('id')

    expect(label.text()).toBe('通行密码')
    expect(inputId).toBeTruthy()
    expect(label.attributes('for')).toBe(inputId)
  })

  it('renders a standard labeled input without decorative markers', () => {
    const wrapper = mount(PInput, {
      props: {
        modelValue: 'value',
        label: '标题',
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(false)
    expect(wrapper.get('label').text()).toBe('标题')
    expect(wrapper.find('input').classes()).toContain('p-input')
  })

  it('renders error state when error prop is provided', () => {
    const wrapper = mount(PInput, {
      props: {
        modelValue: '',
        label: '标题',
        error: '此字段必填',
      },
    })

    const input = wrapper.get('input')
    expect(input.classes()).toContain('p-input--error')

    const errorDiv = wrapper.find('.p-field-error')
    expect(errorDiv.exists()).toBe(true)
    expect(errorDiv.text()).toBe('此字段必填')
  })
})
