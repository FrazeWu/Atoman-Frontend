import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudioChannelView from '@/views/studio/StudioChannelView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

const apiMocks = vi.hoisted(() => ({
  post: vi.fn().mockResolvedValue({ id: 'channel-new' }),
  patch: vi.fn().mockResolvedValue({ id: 'channel-2' }),
  remove: vi.fn().mockResolvedValue({ message: 'ok' }),
  upload: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    apiPostJson: apiMocks.post,
    apiPatchJson: apiMocks.patch,
    apiDeleteJson: apiMocks.remove,
    apiRequestResult: apiMocks.upload,
  }
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
  const authStore = useAuthStore(pinia)
  authStore.isAuthenticated = true
  authStore.token = 'test-token'
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
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.upload.mockResolvedValue({ ok: true, data: { url: 'https://assets.test/channel-cover.webp' } })
  })

  it('creates the first channel and returns to dashboard', async () => {
    const { wrapper, store, router } = await setup(false)
    await wrapper.find('[data-testid="new-channel"]').trigger('click')
    await wrapper.find('[data-testid="channel-name"]').setValue('新频道')
    expect(wrapper.find('[data-testid="channel-uuid"]').text()).toBe('保存后生成')
    await wrapper.find('[data-testid="save-channel"]').trigger('click')
    await flushPromises()

    expect(apiMocks.post).toHaveBeenCalledWith('/api/v1/studio/channels', {
      name: '新频道', slug: '', description: '', cover_url: '',
    })
    expect(store.loadState).toHaveBeenCalledWith(true)
    expect(router.currentRoute.value.path).toBe('/studio')
  })

  it('edits switches and deletes an existing channel', async () => {
    const { wrapper, store } = await setup(true)
    await wrapper.find('[data-testid="edit-channel-channel-2"]').trigger('click')
    expect(wrapper.find('[data-testid="channel-uuid"]').text()).toBe('channel-2')
    await wrapper.find('[data-testid="channel-name"]').setValue('新的副频道')
    await wrapper.find('[data-testid="save-channel"]').trigger('click')
    await flushPromises()
    expect(apiMocks.patch).toHaveBeenCalledWith('/api/v1/studio/channels/channel-2', {
      name: '新的副频道', slug: '', description: '', cover_url: '',
    })

    await wrapper.find('[data-testid="select-channel-channel-2"]').trigger('click')
    expect(store.selectChannel).toHaveBeenCalledWith('channel-2')

    await wrapper.find('[data-testid="delete-channel-channel-2"]').trigger('click')
    await wrapper.find('[data-testid="confirm-delete-channel"]').trigger('click')
    await flushPromises()
    expect(apiMocks.remove).toHaveBeenCalledWith('/api/v1/studio/channels/channel-2')
    expect(store.loadState).toHaveBeenCalledWith(true)
  })

  it('uploads a channel cover instead of asking for a URL', async () => {
    const { wrapper } = await setup(false)
    await wrapper.find('[data-testid="new-channel"]').trigger('click')

    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' })
    const input = wrapper.find('[data-testid="channel-cover-input"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(apiMocks.upload).toHaveBeenCalledWith('/api/v1/blog/upload-image', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    }))
    const request = apiMocks.upload.mock.calls[0]?.[1] as RequestInit
    expect((request.body as FormData).get('image')).toBe(file)
    expect(wrapper.find('.cover-preview-image').attributes('src')).toBe('https://assets.test/channel-cover.webp')
    expect(wrapper.find('[data-testid="channel-cover-input"]').exists()).toBe(true)
  })
})
