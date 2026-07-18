import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'

import StudioCollectionSheet from '@/components/studio/StudioCollectionSheet.vue'
import { useStudioStore } from '@/stores/studio'

const PSheet = {
  props: ['show'],
  template: '<section v-if="show" data-testid="studio-collection-sheet"><slot name="header" /><slot /></section>',
}
const PModal = {
  props: ['modelValue'],
  template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
}

describe('StudioCollectionSheet', () => {
  it('creates renames and deletes module collections', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.collections.blog = [{
      id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '旧名称', description: '旧描述', cover_url: '', is_default: false,
      created_at: '', updated_at: '',
    }]
    const wrapper = mount(StudioCollectionSheet, {
      props: { show: true, module: 'blog' },
      global: { plugins: [pinia], stubs: { PSheet, PModal } },
    })

    await wrapper.find('[data-testid="new-collection"]').trigger('click')
    await wrapper.find('[data-testid="collection-name"]').setValue('新合集')
    await wrapper.find('[data-testid="collection-description"]').setValue('新描述')
    await wrapper.find('[data-testid="save-collection"]').trigger('click')
    await flushPromises()
    expect(store.createCollection).toHaveBeenCalledWith('blog', { name: '新合集', description: '新描述' })

    await wrapper.find('[data-testid="edit-collection-collection-1"]').trigger('click')
    await wrapper.find('[data-testid="collection-name"]').setValue('新名称')
    await wrapper.find('[data-testid="save-collection"]').trigger('click')
    await flushPromises()
    expect(store.updateCollection).toHaveBeenCalledWith('blog', 'collection-1', { name: '新名称', description: '旧描述' })

    await wrapper.find('[data-testid="delete-collection-collection-1"]').trigger('click')
    await wrapper.find('[data-testid="confirm-delete-collection"]').trigger('click')
    await flushPromises()
    expect(store.deleteCollection).toHaveBeenCalledWith('blog', 'collection-1')
  })
})
