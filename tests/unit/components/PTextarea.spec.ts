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

  it('renders error state when error prop is provided with accessibility attributes', () => {
    const wrapper = mount(PTextarea, {
      props: {
        modelValue: '',
        label: '摘要',
        error: '描述不能为空',
      },
    })

    const textarea = wrapper.get('textarea')
    const textareaId = textarea.attributes('id')
    expect(textarea.classes()).toContain('p-textarea--error')
    expect(textarea.attributes('aria-invalid')).toBe('true')
    expect(textarea.attributes('aria-describedby')).toBe(`${textareaId}-error`)
    expect(textarea.attributes('aria-errormessage')).toBe(`${textareaId}-error`)

    const errorDiv = wrapper.find('.p-field-error')
    expect(errorDiv.exists()).toBe(true)
    expect(errorDiv.text()).toBe('描述不能为空')
    expect(errorDiv.attributes('id')).toBe(`${textareaId}-error`)
    expect(errorDiv.attributes('role')).toBe('alert')
    expect(errorDiv.attributes('aria-live')).toBe('polite')
  })

  it('renders hint state with accessibility attributes when hint prop is provided and no error', () => {
    const wrapper = mount(PTextarea, {
      props: {
        modelValue: '',
        label: '摘要',
        hint: '请输入最多200字',
      },
    })

    const textarea = wrapper.get('textarea')
    const textareaId = textarea.attributes('id')
    expect(textarea.attributes('aria-invalid')).toBeUndefined()
    expect(textarea.attributes('aria-errormessage')).toBeUndefined()
    expect(textarea.attributes('aria-describedby')).toBe(`${textareaId}-hint`)

    const hintDiv = wrapper.find('.p-field-hint')
    expect(hintDiv.exists()).toBe(true)
    expect(hintDiv.text()).toBe('请输入最多200字')
    expect(hintDiv.attributes('id')).toBe(`${textareaId}-hint`)
    expect(wrapper.find('.p-field-error').exists()).toBe(false)
  })
})
