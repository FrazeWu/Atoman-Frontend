import { mount } from '@vue/test-utils'

import PSelect from '@/components/ui/PSelect.vue'

describe('PSelect', () => {
  it('renders a standard labeled select and its options', async () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: 'album',
        label: '专辑类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(false)
    expect(wrapper.get('label').text()).toBe('专辑类型')

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.p-select-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('EP')
  })

  it('renders error state when error prop is provided with accessibility attributes', () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: '',
        label: '专辑类型',
        error: '请选择专辑类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    const trigger = wrapper.get('.p-select-trigger')
    const triggerId = trigger.attributes('id')
    expect(trigger.classes()).toContain('p-select-trigger--error')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-describedby')).toBe(`${triggerId?.replace('-trigger', '')}-error`)
    expect(trigger.attributes('aria-errormessage')).toBe(`${triggerId?.replace('-trigger', '')}-error`)

    const errorDiv = wrapper.find('.p-field-error')
    expect(errorDiv.exists()).toBe(true)
    expect(errorDiv.text()).toBe('请选择专辑类型')
    expect(errorDiv.attributes('id')).toBe(trigger.attributes('aria-errormessage'))
    expect(errorDiv.attributes('role')).toBe('alert')
    expect(errorDiv.attributes('aria-live')).toBe('polite')
  })

  it('renders hint state with accessibility attributes when hint prop is provided and no error', () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: '',
        label: '专辑类型',
        hint: '请选择符合规则的类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    const trigger = wrapper.get('.p-select-trigger')
    const triggerId = trigger.attributes('id')
    expect(trigger.attributes('aria-invalid')).toBeUndefined()
    expect(trigger.attributes('aria-errormessage')).toBeUndefined()
    expect(trigger.attributes('aria-describedby')).toBe(`${triggerId?.replace('-trigger', '')}-hint`)

    const hintDiv = wrapper.find('.p-field-hint')
    expect(hintDiv.exists()).toBe(true)
    expect(hintDiv.text()).toBe('请选择符合规则的类型')
    expect(hintDiv.attributes('id')).toBe(trigger.attributes('aria-describedby'))
    expect(wrapper.find('.p-field-error').exists()).toBe(false)
  })
})
