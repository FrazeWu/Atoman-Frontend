import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import VideoSearchView from '@/views/video/VideoSearchView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const ModuleSearchStub = {
  name: 'ModuleSearch',
  props: ['modelValue', 'targetTypes'],
  emits: ['update:modelValue', 'select'],
  template: '<input data-testid="video-search-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

describe('VideoSearchView', () => {
  it('使用后端模块搜索并仅查询视频资源', async () => {
    const wrapper = mount(VideoSearchView, {
      global: { stubs: { ModuleSearch: ModuleSearchStub, PPageHeader: { template: '<header />' } } },
    })

    const search = wrapper.findComponent(ModuleSearchStub)
    expect(search.props('targetTypes')).toEqual(['video'])

    await search.vm.$emit('select', {
      type: 'video', id: 'video-1', label: '示例视频', module: 'video', path: '/watch/video-1', available: true,
    })
    expect(push).toHaveBeenCalledWith('/videos/watch/video-1')
  })
})
