import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import { defineComponent, nextTick, ref } from 'vue'

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

  it('keeps year, month, and day digits in input order while typing', async () => {
    const model = ref({ year: '', month: '', day: '' })
    const wrapper = mount(defineComponent({
      components: { PMaskedDateInput },
      setup() {
        return { model }
      },
      template: '<PMaskedDateInput v-model="model" />',
    }))
    const inputWrapper = wrapper.find('input[type="text"]')
    const input = inputWrapper.element as HTMLInputElement

    await inputWrapper.trigger('focus')
    for (const digit of '20260807') {
      const start = input.selectionStart ?? 0
      const end = input.selectionEnd ?? start
      input.setRangeText(digit, start, end, 'end')
      await inputWrapper.trigger('input')
      await nextTick()
    }

    expect(input.value).toBe('2026/08/07')
    expect(model.value).toEqual({
      year: '2026',
      month: '08',
      day: '07',
    })
  })
})
