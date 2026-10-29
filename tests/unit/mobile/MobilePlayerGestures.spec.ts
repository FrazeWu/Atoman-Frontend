import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import MobilePlayerView from '@mobile/MobilePlayerView.vue'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicHome: vi.fn(),
  listPublicMusicPlaylists: vi.fn(),
  listMusicPlaylists: vi.fn(),
  listPlaylistBookmarks: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  listMusicSongs: vi.fn(),
  searchMusicSongs: vi.fn(),
  createMusicPlaylist: vi.fn(),
}))

describe('MobilePlayerView Gestures (Pull-to-Dismiss & Swipe-to-Skip)', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: { template: '<div>Music Home</div>' } },
        { path: '/music/player', component: MobilePlayerView },
      ],
    })
    vi.clearAllMocks()
  })

  function createWrapper() {
    const playerStore = usePlayerStore()
    playerStore.currentSong = {
      id: 's-gesture-1',
      title: 'Solar Winds',
      artist: 'Aethel',
      duration: 200,
    } as any

    return mount(MobilePlayerView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PortalTeleport: true,
        },
      },
    })
  }

  it('pulling down on the header updates the container translateY style', async () => {
    const wrapper = createWrapper()
    const header = wrapper.find('.mobile-player-view__header')
    expect(header.exists()).toBe(true)

    // Touch start at clientY = 100
    await header.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
    })

    // Touch move to clientY = 160 (deltaY = 60)
    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 160 } as any],
        bubbles: true,
        cancelable: true,
      })
    )
    await wrapper.vm.$nextTick()

    const containerStyle = wrapper.find('.mobile-player-view').attributes('style') || ''
    expect(containerStyle).toContain('translateY(60px)')
  })

  it('pulling down beyond threshold (>72px) triggers dismiss on touchend', async () => {
    const wrapper = createWrapper()
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => {})
    const header = wrapper.find('.mobile-player-view__header')

    await header.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
    })

    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 200 } as any], // deltaY = 100 > 72
        bubbles: true,
        cancelable: true,
      })
    )
    await wrapper.vm.$nextTick()

    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [{ clientX: 200, clientY: 200 } as any],
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()
    // Wait for the dismiss animation timer
    await new Promise((r) => setTimeout(r, 220))

    expect(pushSpy).toHaveBeenCalledWith('/music')
  })

  it('pulling down below threshold (<72px) snaps container back to 0 without dismissing', async () => {
    const wrapper = createWrapper()
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => {})
    const header = wrapper.find('.mobile-player-view__header')

    await header.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
    })

    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 140 } as any], // deltaY = 40 < 72
        bubbles: true,
        cancelable: true,
      })
    )
    await wrapper.vm.$nextTick()

    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [{ clientX: 200, clientY: 140 } as any],
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 220))

    expect(pushSpy).not.toHaveBeenCalled()
    const containerStyle = wrapper.find('.mobile-player-view').attributes('style') || ''
    expect(containerStyle).not.toContain('translateY(40px)')
  })

  it('touches originating on interactive controls do not initiate pull-to-dismiss dragging', async () => {
    const wrapper = createWrapper()
    const playBtn = wrapper.find('.mobile-player-view__control--primary')
    expect(playBtn.exists()).toBe(true)

    await playBtn.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
    })

    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 200 } as any],
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()

    const containerStyle = wrapper.find('.mobile-player-view').attributes('style') || ''
    expect(containerStyle).not.toContain('translateY(100px)')
  })

  it('swiping left on the stage triggers player.playNext()', async () => {
    const wrapper = createWrapper()
    const playerStore = usePlayerStore()
    const nextSpy = vi.spyOn(playerStore, 'playNext').mockImplementation(() => {})
    const stage = wrapper.find('.mobile-player-view__stage')
    expect(stage.exists()).toBe(true)

    await stage.trigger('touchstart', {
      touches: [{ clientX: 250, clientY: 200 }],
    })

    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 170, clientY: 205 } as any], // deltaX = -80, deltaY = 5
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()

    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [{ clientX: 170, clientY: 205 } as any],
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()

    expect(nextSpy).toHaveBeenCalled()
  })

  it('swiping right on the stage triggers player.playPrevious()', async () => {
    const wrapper = createWrapper()
    const playerStore = usePlayerStore()
    const prevSpy = vi.spyOn(playerStore, 'playPrevious').mockImplementation(() => {})
    const stage = wrapper.find('.mobile-player-view__stage')
    expect(stage.exists()).toBe(true)

    await stage.trigger('touchstart', {
      touches: [{ clientX: 150, clientY: 200 }],
    })

    window.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 230, clientY: 205 } as any], // deltaX = +80, deltaY = 5
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()

    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [{ clientX: 230, clientY: 205 } as any],
        bubbles: true,
      })
    )
    await wrapper.vm.$nextTick()

    expect(prevSpy).toHaveBeenCalled()
  })
  it('exposes native keyboard-operable cover and timed lyric controls', async () => {
    const wrapper = createWrapper()
    const player = usePlayerStore()
    player.currentSong = {
      ...player.currentSong!,
      lyrics: '[00:05.00]First line\nUntimed note\n[00:15.00]Second line',
    }
    await wrapper.vm.$nextTick()
    const cover = wrapper.find('.mobile-player-view__cover-wrap')
    expect(cover.element.tagName).toBe('BUTTON')
    await cover.trigger('click')
    const lines = wrapper.findAll('.mobile-player-view__lyric-line')
    expect(lines).toHaveLength(3)
    expect(lines[0]!.element.tagName).toBe('BUTTON')
    expect(lines[1]!.attributes('disabled')).toBeDefined()
    const seekSpy = vi.spyOn(player, 'seek').mockImplementation(() => {})
    await lines[2]!.trigger('click')
    expect(seekSpy).toHaveBeenCalledWith(15)
    wrapper.unmount()
  })

})
