import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { nestedAction: 'history' } },
    closeNestedAction: vi.fn()
  })
}))

describe('NestedActionDrawer.vue', () => {
  it('renders when action is present', () => {
    const wrapper = mount(NestedActionDrawer, { global: { stubs: ['PaperSheet'] } })
    expect(wrapper.findComponent({ name: 'PaperSheet' }).exists()).toBe(true)
  })
})
