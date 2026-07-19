import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RouteContentLoading from '@/components/system/RouteContentLoading.vue'

describe('RouteContentLoading.vue', () => {
  it('正确渲染包含无障碍 role 与 aria 属性的加载容器', () => {
    const wrapper = mount(RouteContentLoading)
    
    const root = wrapper.find('.route-content-loading')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-live')).toBe('polite')
    
    const progressTrack = wrapper.find('.progress-line-track')
    expect(progressTrack.exists()).toBe(true)
    
    const progressBar = wrapper.find('.progress-line-bar')
    expect(progressBar.exists()).toBe(true)
    
    expect(wrapper.text()).toContain('正在加载')
    wrapper.unmount()
  })
})
