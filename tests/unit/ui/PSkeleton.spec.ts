import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PSkeleton from '@/components/ui/PSkeleton.vue'

describe('PSkeleton.vue', () => {
  it('正确渲染包含 shimmer 类名与对应的样式尺寸', () => {
    const wrapper = mount(PSkeleton, {
      props: { width: '100px', height: '20px', variant: 'rect' }
    })
    const skeleton = wrapper.find('.p-skeleton')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.classes()).toContain('p-skeleton--rect')
    expect(skeleton.element.style.width).toBe('100px')
    expect(skeleton.element.style.height).toBe('20px')
    wrapper.unmount()
  })
})
