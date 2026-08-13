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

    await wrapper.get('input[placeholder="如 1800"]').setValue('1800')
    await wrapper.get('input[placeholder="政治 / 文化 / 科技…"]').setValue('政治')
    await wrapper.findAll('button').find((button) => button.text() === '筛选')?.trigger('click')
    await wrapper.get('.tl-action-btn').trigger('click')

    expect(wrapper.emitted('update:yearStart')?.[0]).toEqual([1800])
    expect(wrapper.emitted('update:category')?.[0]).toEqual(['政治'])
    expect(wrapper.emitted('apply')).toHaveLength(1)
    expect(wrapper.emitted('add-batch-to-compare')).toHaveLength(1)
  })
})
