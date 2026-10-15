import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TimelineSearchView from '@/views/timeline/TimelineSearchView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const ModuleSearchStub = {
  name: 'ModuleSearch',
  props: ['modelValue', 'targetTypes'],
  emits: ['update:modelValue', 'select'],
  template: '<input data-testid="timeline-search-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

describe('TimelineSearchView', () => {
  it('使用后端模块搜索并查询人物与事件资源', async () => {
    const wrapper = mount(TimelineSearchView, {
      global: { stubs: { ModuleSearch: ModuleSearchStub, PPageHeader: { template: '<header />' } } },
    })

    const search = wrapper.findComponent(ModuleSearchStub)
    expect(search.props('targetTypes')).toEqual(['person', 'event'])

    await search.vm.$emit('select', {
      type: 'person', id: 'person-1', label: '苏轼', module: 'timeline', path: '/person/person-1', available: true,
    })
    expect(push).toHaveBeenCalledWith('/timeline/person/person-1')
  })
})
