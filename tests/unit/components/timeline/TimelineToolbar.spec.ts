import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimelineToolbar from '@/components/timeline/TimelineToolbar.vue'

describe('TimelineToolbar', () => {
  it('forwards filter values and comparison actions', async () => {
    const wrapper = mount(TimelineToolbar, {
      props: {
        yearStart: null,
        yearEnd: null,
        category: '',
        batchSelectedCount: 2,
        viewMode: 'lanes',
      },
    })

    await wrapper.find('input[type="number"]').setValue('1800')
    await wrapper.find('input[type="text"]').setValue('政治')
    await wrapper.get('button').trigger('click')
    await wrapper.get('.tl-action-btn').trigger('click')

    expect(wrapper.emitted('update:yearStart')?.[0]).toEqual([1800])
    expect(wrapper.emitted('update:category')?.[0]).toEqual(['政治'])
    expect(wrapper.emitted('apply')).toHaveLength(1)
    expect(wrapper.emitted('add-batch-to-compare')).toHaveLength(1)
  })
})
