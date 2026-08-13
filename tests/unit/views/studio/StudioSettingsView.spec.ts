import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioSettingsView from '@/views/studio/StudioSettingsView.vue'
import { useStudioStore } from '@/stores/studio'

async function selectOption(wrapper: ReturnType<typeof mount>, testId: string, label: string) {
  const field = wrapper.get(`[data-testid="${testId}"]`)
  await field.get('.p-select-trigger').trigger('click')
  await field.findAll('.p-select-option').find(option => option.text() === label)!.trigger('click')
}

async function setup(module: 'blog' | 'podcast') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/studio/:module/settings', component: { template: '<div />' } }] })
  await router.push(`/studio/${module}/settings`)
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const store = useStudioStore(pinia)
  store.loaded = true
  store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
  store.collections[module] = [{
    id: 'collection-1', channel_id: 'channel-1', content_type: module, name: '默认合集', description: '',
    cover_url: '', is_default: false, created_at: '', updated_at: '',
  }]
  store.settings[module] = {
    channel_id: 'channel-1', module, default_collection_id: null, default_visibility: 'public',
    default_publish_status: 'published', autoplay_enabled: false,
  }
  const wrapper = mount(StudioSettingsView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, store }
}

describe('StudioSettingsView', () => {
  it('loads current channel module settings and hides autoplay for blog', async () => {
    const { wrapper, store } = await setup('blog')
    expect(store.loadCollections).toHaveBeenCalledWith('blog')
    expect(store.loadSettings).toHaveBeenCalledWith('blog')
    expect(wrapper.find('[data-testid="autoplay-setting"]').exists()).toBe(false)
  })

  it('saves collection visibility publish status and autoplay for podcasts', async () => {
    const { wrapper, store } = await setup('podcast')
    await selectOption(wrapper, 'default-collection-setting', '默认合集')
    await selectOption(wrapper, 'visibility-setting', '订阅者')
    await selectOption(wrapper, 'publish-status-setting', '草稿')
    await wrapper.find('[data-testid="autoplay-setting"]').setValue(true)
    await wrapper.find('[data-testid="save-settings"]').trigger('click')
    await flushPromises()

    expect(store.saveSettings).toHaveBeenCalledWith('podcast', {
      default_collection_id: 'collection-1',
      default_visibility: 'subscribers',
      default_publish_status: 'draft',
      autoplay_enabled: true,
    })
  })

  it('does not show saved feedback when saving is discarded', async () => {
    const { wrapper, store } = await setup('blog')
    vi.mocked(store.saveSettings).mockResolvedValue(false)

    await wrapper.find('[data-testid="save-settings"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('shows saved feedback when settings are written', async () => {
    const { wrapper, store } = await setup('blog')
    vi.mocked(store.saveSettings).mockResolvedValue(true)

    await wrapper.find('[data-testid="save-settings"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="status"]').text()).toBe('已保存')
  })
})
