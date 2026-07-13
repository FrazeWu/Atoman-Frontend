import { mount } from '@vue/test-utils'

import PToast from '@/components/ui/PToast.vue'

describe('PToast', () => {
  it('renders info toast by default', () => {
    const wrapper = mount(PToast, {
      props: {
        message: 'Hello World',
        modelValue: true,
      },
    })
    expect(wrapper.find('.p-toast').exists()).toBe(true)
    expect(wrapper.find('.p-toast').classes()).toContain('p-toast--info')
    expect(wrapper.text()).toContain('Hello World')
  })

  it('renders success toast with correct class', () => {
    const wrapper = mount(PToast, {
      props: {
        message: 'Success Message',
        type: 'success',
        modelValue: true,
      },
    })
    expect(wrapper.find('.p-toast').classes()).toContain('p-toast--success')
  })

  it('renders danger toast with correct class', () => {
    const wrapper = mount(PToast, {
      props: {
        message: 'Error Message',
        type: 'danger',
        modelValue: true,
      },
    })
    expect(wrapper.find('.p-toast').classes()).toContain('p-toast--danger')
  })

  it('renders warning toast with correct class', () => {
    const wrapper = mount(PToast, {
      props: {
        message: '需要重试',
        type: 'warning',
        modelValue: true,
      },
    })

    expect(wrapper.find('.p-toast').classes()).toContain('p-toast--warning')
  })
})
