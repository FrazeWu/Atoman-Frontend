import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioContentView from '@/views/studio/StudioContentView.vue'
import StudioModuleLayout from '@/views/studio/StudioModuleLayout.vue'
import { useStudioStore } from '@/stores/studio'

const routes = [{
  path: '/studio/:module',
  component: StudioModuleLayout,
  children: [{ path: 'content', component: StudioContentView }],
}]

describe('StudioContentView', () => {
  it('renders module navigation and requests route-backed content filters', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content?q=research&status=draft&visibility=subscribers&collection_id=collection-1&page=2')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.channels = [store.currentChannel]
    store.collections.blog = [{
      id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '研究', description: '', cover_url: '', is_default: false,
      created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
    }]

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.findAll('.studio-module__header nav a').map(link => link.text())).toEqual(['内容', '数据', '互动', '设置'])
    expect(store.loadContents).toHaveBeenCalledWith('blog', {
      q: 'research', status: 'draft', visibility: 'subscribers', collection_id: 'collection-1', page: 2,
    })
    expect(wrapper.find('[data-testid="create-content"]').attributes('href')).toBe('/studio/blog/new?collection=collection-1')
  })

  it('keeps filter changes in route query and omits collection for all collections', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content?collection_id=collection-1&page=3')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.collections.blog = [{
      id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '研究', description: '', cover_url: '', is_default: false,
      created_at: '', updated_at: '',
    }]

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.find('[data-testid="status-filter"]').setValue('published')
    await flushPromises()

    expect(router.currentRoute.value.query.status).toBe('published')
    expect(router.currentRoute.value.query.page).toBeUndefined()

    await wrapper.find('[data-testid="collection-filter"]').setValue('')
    await flushPromises()
    expect(router.currentRoute.value.query.collection_id).toBeUndefined()
    expect(wrapper.find('[data-testid="create-content"]').attributes('href')).toBe('/studio/blog/new')

    await wrapper.find('[data-testid="manage-collections"]').trigger('click')
    expect(wrapper.find('[data-testid="studio-collection-sheet"]').exists()).toBe(true)
  })
})
