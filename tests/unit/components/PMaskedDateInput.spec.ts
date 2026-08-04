import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import { nextTick } from 'vue'

describe('PMaskedDateInput', () => {
  it('renders with initial yyyy/mm/dd placeholder digits when empty', () => {
    const wrapper = mount(PMaskedDateInput, {
      props: {
        modelValue: { year: '', month: '', day: '' },
        label: '出生日期',
      },
    })
    const input = wrapper.find('input[type="text"]').element as HTMLInputElement
    expect(input.value).toBe('yyyy/mm/dd')
  })

  it('formats initial model value correctly', () => {
    const wrapper = mount(PMaskedDateInput, {
      props: {
        modelValue: { year: '2026', month: '08', day: '03' },
        label: '出生日期',
      },
    })
    const input = wrapper.find('input[type="text"]').element as HTMLInputElement
    expect(input.value).toBe('2026/08/03')
  })

  it('forces cursor to the first empty slot on click and focus', async () => {
    const wrapper = mount(PMaskedDateInput, {
      props: {
        modelValue: { year: '2026', month: 'mm', day: 'dd' },
      },
    })
    const inputWrapper = wrapper.find('input[type="text"]')
    const input = inputWrapper.element as HTMLInputElement

    // Mock setSelectionRange
    const setSelectionRangeSpy = vi.spyOn(input, 'setSelectionRange')

    // Click on input
    await inputWrapper.trigger('click')
    // Since '2026' is filled, internalDigits is '2026' (4 digits), first empty slot should be index 5 (month position)
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(5, 5)

    // Focus on input
    await inputWrapper.trigger('focus')
    expect(setSelectionRangeSpy).toHaveBeenLastCalledWith(5, 5)
  })
})
