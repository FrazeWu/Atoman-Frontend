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

  it('renders paper field affordances', () => {
    const wrapper = mount(PInput, {
      props: {
        modelValue: 'value',
        label: '标题',
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(true)
    expect(wrapper.find('input').classes()).toContain('p-input')
  })
})
