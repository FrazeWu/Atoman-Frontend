import { mount } from '@vue/test-utils'

import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'

describe('PCountryRegionField', () => {
  it('filters and selects a country region option', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: '',
        label: '地区',
      },
    })

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')
    await wrapper.get('[data-test="artist-nationality-search-input"]').setValue('tokyo')
    await wrapper.get('[data-test="artist-nationality-option-Tokyo"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Japan / Tokyo'])
  })
})
