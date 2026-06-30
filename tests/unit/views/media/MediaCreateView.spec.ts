import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MediaCreateView from '@/views/media/MediaCreateView.vue'
import { useMediaCollections } from '@/composables/useMediaCollections'

const loadChannelsMock = vi.fn()
const currentMediaChannelIdMock = ref('channel-1')

vi.mock('@/composables/useMediaChannel', () => ({
  useMediaChannel: () => ({
    channels: { value: [{ id: 'channel-1', name: '我的频道' }] },
    currentMediaChannelId: currentMediaChannelIdMock,
    switchChannel: vi.fn(),
    loadChannels: loadChannelsMock,
  }),
}))

describe('MediaCreateView', () => {
  beforeEach(() => {
    loadChannelsMock.mockReset()
    currentMediaChannelIdMock.value = 'channel-1'
    const { clearSelectionForTest } = useMediaCollections()
    clearSelectionForTest()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/collections')) {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 })
      }
      if (url.includes('/blog/posts') || url.includes('/podcast/episodes') || url.includes('/videos')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })
  })

  it('disables publish button before a collection is selected', () => {
    const wrapper = mount(MediaCreateView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: [
          'MediaCollectionRail',
          'MediaMixedFeedSection',
          'MediaVideoCardSection',
          'MediaCollectionWorkspace',
        ],
      },
    })
    const button = wrapper.get('[data-testid="media-publish-button"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('请先选择一个合集')
  })

  it('composes the media overview sections instead of rendering duplicate inline blocks', () => {
    const wrapper = mount(MediaCreateView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          MediaCollectionRail: { template: '<section data-testid="collection-rail" />' },
          MediaMixedFeedSection: { template: '<section data-testid="mixed-feed" />' },
          MediaVideoCardSection: { template: '<section data-testid="video-section" />' },
          MediaCollectionWorkspace: { template: '<section data-testid="collection-workspace" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="collection-rail"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mixed-feed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="video-section"]').exists()).toBe(true)
  })

  it('loads only the current user channels for the create workspace', () => {
    mount(MediaCreateView, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              token: 'token-1',
              user: { id: 1, uuid: 'user-uuid-1', username: 'alice', email: 'alice@example.com', role: 'user' },
              isAuthenticated: true,
            },
          },
        })],
        stubs: [
          'MediaCollectionRail',
          'MediaMixedFeedSection',
          'MediaVideoCardSection',
          'MediaCollectionWorkspace',
        ],
      },
    })

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-1')
  })

  it('publishes through the explicit blog module publishing route', () => {
    const { selectCollection } = useMediaCollections()
    selectCollection('collection-1', 'article', '长文合集')

    const wrapper = mount(MediaCreateView, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              token: 'token-1',
              user: { id: 1, uuid: 'user-uuid-1', username: 'alice', email: 'alice@example.com', role: 'user' },
              isAuthenticated: true,
            },
          },
        })],
        stubs: [
          'RouterLink',
          'MediaCollectionRail',
          'MediaMixedFeedSection',
          'MediaVideoCardSection',
          'MediaCollectionWorkspace',
        ],
      },
    })

    expect(wrapper.getComponent({ name: 'PButton' }).props('to')).toContain('/posts')
  })

  it('publishes video collections through the video upload route', () => {
    const { selectCollection } = useMediaCollections()
    selectCollection('collection-1', 'video', '视频合集')

    const wrapper = mount(MediaCreateView, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              token: 'token-1',
              user: { id: 1, uuid: 'user-uuid-1', username: 'alice', email: 'alice@example.com', role: 'user' },
              isAuthenticated: true,
            },
          },
        })],
        stubs: [
          'RouterLink',
          'MediaCollectionRail',
          'MediaMixedFeedSection',
          'MediaVideoCardSection',
          'MediaCollectionWorkspace',
        ],
      },
    })

    expect(wrapper.getComponent({ name: 'PButton' }).props('to')).toContain('/videos/upload')
  })
})
