import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MediaCollectionWorkspace from '@/components/media/MediaCollectionWorkspace.vue'

vi.mock('@/composables/useMediaCollections', () => ({
  useMediaCollections: () => ({
    selectedCollectionId: { value: 'col-2' },
    selectedCollection: { value: { id: 'col-2', type: 'podcast', name: '访谈播客' } },
  }),
}))

describe('MediaCollectionWorkspace', () => {
  it('renders podcast workspace when selected collection type is podcast', () => {
    const wrapper = mount(MediaCollectionWorkspace)
    expect(wrapper.text()).toContain('播客工作区')
  })
})
