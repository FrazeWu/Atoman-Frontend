import { mount } from '@vue/test-utils'

import AInput from '@/components/ui/AInput.vue'

describe('AInput', () => {
  it('associates label text with the input control', () => {
    const wrapper = mount(AInput, {
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
})
