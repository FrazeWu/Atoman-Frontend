import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import MobileAudioPlayer from '@mobile/MobileAudioPlayer.vue'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

describe('MobileAudioPlayer Gestures (Micro-displacement & Drag to Expand)', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: { template: '<div>Music</div>' } },
        { path: '/music/player', component: { template: '<div>Player</div>' } },
      ],
    })
    vi.clearAllMocks()
  })

  function createWrapper() {
    const playerStore = usePlayerStore()
    playerStore.currentSong = {
      id: 's-mini-1',
      title: 'Aurora Night',
      artist: 'Solaris',
      duration: 180,
    } as any

    return mount(MobileAudioPlayer, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PortalTeleport: true,
        },
      },
    })
  }

  it('dragging upward produces micro-displacement transform translateY', async () => {
    const wrapper = createWrapper()
    const trackBtn = wrapper.find('.mobile-mini-player__track')
    expect(trackBtn.exists()).toBe(true)

    await trackBtn.trigger('touchstart', {
      touches: [{ clientX: 100, clientY: 200 }],
    })

    await trackBtn.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 170 }], // deltaY = -30
    })

    const rootStyle = wrapper.find('.mobile-mini-player').attributes('style') || ''
    expect(rootStyle).toContain('translateY(-')
  })

  it('releasing after upward drag > 40px triggers openPlayer (navigates to /music/player)', async () => {
    const wrapper = createWrapper()
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => {})
    const trackBtn = wrapper.find('.mobile-mini-player__track')

    await trackBtn.trigger('touchstart', {
      touches: [{ clientX: 100, clientY: 200 }],
    })

    await trackBtn.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 150 }], // deltaY = -50
    })

    await trackBtn.trigger('touchend', {
      changedTouches: [{ clientX: 100, clientY: 150 }],
    })

    expect(pushSpy).toHaveBeenCalledWith('/music/player')
  })

  it('releasing after upward drag < 40px snaps back to translateY(0px) without navigating', async () => {
    const wrapper = createWrapper()
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => {})
    const trackBtn = wrapper.find('.mobile-mini-player__track')

    await trackBtn.trigger('touchstart', {
      touches: [{ clientX: 100, clientY: 200 }],
    })

    await trackBtn.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 180 }], // deltaY = -20
    })

    await trackBtn.trigger('touchend', {
      changedTouches: [{ clientX: 100, clientY: 180 }],
    })

    expect(pushSpy).not.toHaveBeenCalled()
    const rootStyle = wrapper.find('.mobile-mini-player').attributes('style') || ''
    expect(rootStyle).toContain('translateY(0px)')
  })
})
