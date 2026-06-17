import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import KanboCreateView from '@/views/kanbo/KanboCreateView.vue'
import { useKanboCollections } from '@/composables/useKanboCollections'

const loadChannelsMock = vi.fn()
const currentKanboChannelIdMock = ref('channel-1')

vi.mock('@/composables/useKanboChannel', () => ({
  useKanboChannel: () => ({
    channels: { value: [{ id: 'channel-1', name: '我的频道' }] },
    currentKanboChannelId: currentKanboChannelIdMock,
    switchChannel: vi.fn(),
    loadChannels: loadChannelsMock,
  }),
}))

describe('KanboCreateView', () => {
  beforeEach(() => {
    loadChannelsMock.mockReset()
    currentKanboChannelIdMock.value = 'channel-1'
    const { clearSelectionForTest } = useKanboCollections()
    clearSelectionForTest()
  })

  it('disables publish button before a collection is selected', () => {
    const wrapper = mount(KanboCreateView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: [
          'KanboCollectionRail',
          'KanboMixedFeedSection',
          'KanboVideoCardSection',
          'KanboCollectionWorkspace',
        ],
      },
    })
    const button = wrapper.get('[data-testid="kanbo-publish-button"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('请先选择一个合集')
  })

  it('composes the kanbo overview sections instead of rendering duplicate inline blocks', () => {
    const wrapper = mount(KanboCreateView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          KanboCollectionRail: { template: '<section data-testid="collection-rail" />' },
          KanboMixedFeedSection: { template: '<section data-testid="mixed-feed" />' },
          KanboVideoCardSection: { template: '<section data-testid="video-section" />' },
          KanboCollectionWorkspace: { template: '<section data-testid="collection-workspace" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="collection-rail"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mixed-feed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="video-section"]').exists()).toBe(true)
  })

  it('loads only the current user channels for the create workspace', () => {
    mount(KanboCreateView, {
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
          'KanboCollectionRail',
          'KanboMixedFeedSection',
          'KanboVideoCardSection',
          'KanboCollectionWorkspace',
        ],
      },
    })

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-1')
  })

  it('publishes through the legacy content module route instead of the kanbo route table', () => {
    const { selectCollection } = useKanboCollections()
    selectCollection('collection-1', 'article', '长文合集')

    const wrapper = mount(KanboCreateView, {
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
          'KanboCollectionRail',
          'KanboMixedFeedSection',
          'KanboVideoCardSection',
          'KanboCollectionWorkspace',
        ],
      },
    })

    expect(wrapper.getComponent({ name: 'PButton' }).props('to')).toContain('site=blog')
  })
})
