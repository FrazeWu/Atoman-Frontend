import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContentScheduleControl from '@/components/content/ContentScheduleControl.vue'

describe('ContentScheduleControl', () => {
  it('emits the selected local time and schedule action', async () => {
    const wrapper = mount(ContentScheduleControl, { props: { modelValue: '', busy: false } })
    await wrapper.get('input[type="datetime-local"]').setValue('2026-08-01T09:30')
    await wrapper.setProps({ modelValue: '2026-08-01T09:30' })
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-08-01T09:30'])
    expect(wrapper.emitted('schedule')).toHaveLength(1)
  })
})
