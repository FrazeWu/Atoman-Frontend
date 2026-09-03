import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import VideoFavoritesView from '@/views/video/VideoFavoritesView.vue'
import { useAuthStore } from '@/stores/auth'

const load = vi.fn()
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })

vi.mock('@/composables/useVideoBookmarks', () => ({
  useVideoBookmarks: () => ({
    records: ref({
      'video-1': {
        id: 'bookmark-1',
        video_id: 'video-1',
        video: { id: 'video-1', title: '稍后看的视频' },
      },
    }),
    load,
    removeMany: vi.fn(),
  }),
}))

describe('VideoFavoritesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.token = 'token-1'
    load.mockReset()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/videos/channel-bookmarks')) {
        return response({ data: [{ channel: { id: 'channel-1', name: '视频频道' } }] })
      }
      throw new Error(`unexpected fetch: ${String(input)}`)
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('selects the first available favorites tab by default', async () => {
    const wrapper = mount(VideoFavoritesView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSegmentedControl: true,
          PButton: true,
          PEmpty: true,
          PVideoCard: { props: ['video'], template: '<article>{{ video.title }}</article>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.vm.$.setupState.activeTab).toBe('channel')
    expect(wrapper.text()).toContain('视频频道')
  })

  it('renders the watch-later queue', async () => {
    const wrapper = mount(VideoFavoritesView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSegmentedControl: true,
          PButton: true,
          PEmpty: true,
          PVideoCard: { props: ['video'], template: '<article>{{ video.title }}</article>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()
    wrapper.vm.$.setupState.activeTab = 'watchLater'
    await flushPromises()

    expect(wrapper.text()).toContain('稍后看的视频')
    expect(load).toHaveBeenCalledWith('active', 'latest')
  })
})
