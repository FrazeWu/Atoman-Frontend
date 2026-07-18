import { mount } from '@vue/test-utils'

import PChoiceField from '@/components/ui/PChoiceField.vue'

describe('PChoiceField', () => {
  it('renders and selects an option', async () => {
    const wrapper = mount(PChoiceField, {
      props: {
        modelValue: 'album',
        label: '类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    expect(wrapper.text()).toContain('类型')
    await wrapper.get('button').trigger('click')
    await wrapper.get('[data-test="p-choice-field-option-ep"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['ep'])
  })
})
