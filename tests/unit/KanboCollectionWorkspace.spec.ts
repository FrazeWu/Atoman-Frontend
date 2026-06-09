import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KanboCollectionWorkspace from '@/components/kanbo/KanboCollectionWorkspace.vue'

vi.mock('@/composables/useKanboCollections', () => ({
  useKanboCollections: () => ({
    selectedCollectionId: { value: 'col-2' },
    selectedCollection: { value: { id: 'col-2', type: 'podcast', name: '访谈播客' } },
  }),
}))

describe('KanboCollectionWorkspace', () => {
  it('renders podcast workspace when selected collection type is podcast', () => {
    const wrapper = mount(KanboCollectionWorkspace)
    expect(wrapper.text()).toContain('播客工作区')
  })
})
