import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const mocks = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
  createMusicPlaylist: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: mocks.listMusicPlaylists,
  createMusicPlaylist: mocks.createMusicPlaylist,
}))

describe('MusicSidebarPlaylists.vue', () => {
  beforeEach(() => {
    useMusicDrawers().closeAll()
    mocks.listMusicPlaylists.mockReset()
    mocks.createMusicPlaylist.mockReset()
    mocks.listMusicPlaylists.mockResolvedValue({ data: [] })
  })

  it('reloads playlists when the playlist refresh token changes', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicSidebarPlaylists, {
      global: { plugins: [router] },
    })
    await router.isReady()
    await flushPromises()
    expect(mocks.listMusicPlaylists).toHaveBeenCalledTimes(1)

    useMusicDrawers().refreshPlaylist()
    await flushPromises()

    expect(mocks.listMusicPlaylists).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
