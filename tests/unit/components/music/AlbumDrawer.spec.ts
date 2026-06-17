// web/tests/unit/AlbumDrawer.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { albumId: '1' } },
    closeAlbum: vi.fn(),
    isAlbumShifted: { value: false },
    openNestedAction: vi.fn()
  })
}))

describe('AlbumDrawer.vue', () => {
  it('renders correctly', () => {
    const wrapper = mount(AlbumDrawer, { global: { stubs: ['PaperSheet', 'PaperDiscussionFAB'] } })
    expect(wrapper.findComponent({ name: 'PaperSheet' }).exists()).toBe(true)
  })
})
