import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DebateSearchView from '@/views/debate/DebateSearchView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const ModuleSearchStub = {
  name: 'ModuleSearch',
  props: ['modelValue', 'targetTypes'],
  emits: ['update:modelValue', 'select'],
  template: '<input data-testid="debate-search-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

describe('DebateSearchView', () => {
  it('使用后端模块搜索并仅查询辩论资源', async () => {
    const wrapper = mount(DebateSearchView, {
      global: { stubs: { ModuleSearch: ModuleSearchStub, PPageHeader: { template: '<header />' } } },
    })

    const search = wrapper.findComponent(ModuleSearchStub)
    expect(search.props('targetTypes')).toEqual(['debate'])

    await search.vm.$emit('select', {
      type: 'debate', id: 'debate-1', label: '示例辩题', module: 'debate', path: '/debate/debate-1', available: true,
    })
    expect(push).toHaveBeenCalledWith('/debate/debate-1')
  })
})
