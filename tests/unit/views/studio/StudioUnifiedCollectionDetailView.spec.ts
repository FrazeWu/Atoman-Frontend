import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioUnifiedCollectionDetailView from '@/views/studio/StudioUnifiedCollectionDetailView.vue'
import { useStudioStore } from '@/stores/studio'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/studio/manage/collections/:id', component: { template: '<div />' } }],
  })
  await router.push('/studio/manage/collections/collection-1')
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const store = useStudioStore(pinia)
  store.loaded = true
  store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
  store.unifiedCollections = [{
    id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '研究', description: '研究笔记',
    cover_url: '', is_default: false, created_at: '', updated_at: '',
  }]
  store.unifiedCollectionContentsCollectionID = 'collection-1'
  store.unifiedCollectionContents = [
    { content_id: 'content-blog', id: 'post-1', module: 'blog', title: '文章', cover_url: '', status: 'published', updated_at: '2026-07-18T00:00:00Z', position: 0 },
    { content_id: 'content-video', id: 'video-1', module: 'video', title: '视频', cover_url: '', status: 'draft', updated_at: '2026-07-17T00:00:00Z', position: 1 },
  ]
  const wrapper = mount(StudioUnifiedCollectionDetailView, {
    global: { plugins: [pinia, router], stubs: { RouterLink } },
  })
  await flushPromises()
  return { wrapper, store }
}

describe('StudioUnifiedCollectionDetailView', () => {
  it('shows mixed module members in persisted order and saves a reordered sequence', async () => {
    const { wrapper, store } = await setup()

    expect(wrapper.text()).toContain('研究')
    expect(wrapper.findAll('.studio-collection-detail__list li')).toHaveLength(2)
    expect(wrapper.find('a[href="/studio/blog/post-1/edit"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/studio/video/video-1/edit"]').exists()).toBe(true)

    await wrapper.get('[aria-label="下移文章"]').trigger('click')
    expect(store.reorderUnifiedCollectionContents).toHaveBeenCalledWith('collection-1', [
      'content-video',
      'content-blog',
    ])
  })

  it('reorders collection items when directly typing new position into sequence input', async () => {
    const { wrapper, store } = await setup()

    const inputs = wrapper.findAll('.collection-item-sequence__input')
    expect(inputs.length).toBe(2)

    // Move first item to position 2
    const firstInput = inputs[0]!
    firstInput.element.value = '2'
    await firstInput.trigger('change')

    expect(store.reorderUnifiedCollectionContents).toHaveBeenCalledWith('collection-1', [
      'content-video',
      'content-blog',
    ])
  })

  it('displaces items during dragover and updates order on drop', async () => {
    const { wrapper, store } = await setup()

    const dragHandles = wrapper.findAll('.studio-collection-detail__drag-handle')
    expect(dragHandles.length).toBe(2)

    const items = wrapper.findAll('.studio-collection-detail__list li')
    const dataTransfer = { dropEffect: 'move', setData: vi.fn(), setDragImage: vi.fn() }

    await dragHandles[0]!.trigger('dragstart', { dataTransfer })
    await items[1]!.trigger('dragover', { dataTransfer })

    expect(items[0]!.classes()).toContain('is-dragged')
    expect(items[1]!.classes()).toContain('is-displaced-up')

    await items[1]!.trigger('drop', { dataTransfer })
    expect(store.reorderUnifiedCollectionContents).toHaveBeenCalledWith('collection-1', [
      'content-video',
      'content-blog',
    ])
  })
})
