import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudioChannelView from '@/views/studio/StudioChannelView.vue'
import { useStudioStore } from '@/stores/studio'

const apiMocks = vi.hoisted(() => ({
  post: vi.fn().mockResolvedValue({ id: 'channel-new' }),
  patch: vi.fn().mockResolvedValue({ id: 'channel-2' }),
  remove: vi.fn().mockResolvedValue({ message: 'ok' }),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, apiPostJson: apiMocks.post, apiPatchJson: apiMocks.patch, apiDeleteJson: apiMocks.remove }
})

const PModal = {
  props: ['modelValue'],
  template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
}

async function setup(withChannels: boolean) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/studio/channel', component: { template: '<div />' } },
      { path: '/studio', component: { template: '<div />' } },
    ],
  })
  await router.push('/studio/channel')
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const store = useStudioStore(pinia)
  store.loaded = true
  store.channels = withChannels ? [
    { id: 'channel-1', name: '主频道', slug: 'main', description: '主频道描述', cover_url: '' },
    { id: 'channel-2', name: '副频道', slug: 'side', description: '', cover_url: '' },
  ] : []
  store.currentChannel = withChannels ? store.channels[0] : null
  const wrapper = mount(StudioChannelView, { global: { plugins: [pinia, router], stubs: { PModal } } })
  await flushPromises()
  return { wrapper, store, router }
}

describe('StudioChannelView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the first channel and returns to dashboard', async () => {
    const { wrapper, store, router } = await setup(false)
    await wrapper.find('[data-testid="new-channel"]').trigger('click')
    await wrapper.find('[data-testid="channel-name"]').setValue('新频道')
    await wrapper.find('[data-testid="channel-slug"]').setValue('new-channel')
    await wrapper.find('[data-testid="save-channel"]').trigger('click')
    await flushPromises()

    expect(apiMocks.post).toHaveBeenCalledWith('/api/v1/studio/channels', {
      name: '新频道', slug: 'new-channel', description: '', cover_url: '',
    })
    expect(store.loadState).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/studio')
  })

  it('edits switches and deletes an existing channel', async () => {
    const { wrapper, store } = await setup(true)
    await wrapper.find('[data-testid="edit-channel-channel-2"]').trigger('click')
    await wrapper.find('[data-testid="channel-name"]').setValue('新的副频道')
    await wrapper.find('[data-testid="save-channel"]').trigger('click')
    await flushPromises()
    expect(apiMocks.patch).toHaveBeenCalledWith('/api/v1/studio/channels/channel-2', {
      name: '新的副频道', slug: 'side', description: '', cover_url: '',
    })

    await wrapper.find('[data-testid="select-channel-channel-2"]').trigger('click')
    expect(store.selectChannel).toHaveBeenCalledWith('channel-2')

    await wrapper.find('[data-testid="delete-channel-channel-2"]').trigger('click')
    await wrapper.find('[data-testid="confirm-delete-channel"]').trigger('click')
    await flushPromises()
    expect(apiMocks.remove).toHaveBeenCalledWith('/api/v1/studio/channels/channel-2')
    expect(store.loadState).toHaveBeenCalledWith(true)
  })
})
