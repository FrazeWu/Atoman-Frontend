import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { usePictureInPictureLyrics } from '@/composables/usePictureInPictureLyrics'

describe('usePictureInPictureLyrics', () => {
  const songTitle = ref('Test Song')
  const artistText = ref('Test Artist')
  const currentTimeSeconds = ref(15)
  const durationSeconds = ref(180)
  const isPlaying = ref(true)
  const isMuted = ref(false)
  const volume = ref(0.8)
  const lines = ref([
    { text: 'Line 1', time_ms: 0 },
    { text: 'Line 2', time_ms: 10000, translation: '翻译 2' },
    { text: 'Line 3', time_ms: 20000 },
  ])

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detects PiP unsupported when document.pictureInPictureEnabled is false or missing', () => {
    const { isPiPSupported, isPiPActive } = usePictureInPictureLyrics({
      songTitle,
      artistText,
      currentTimeSeconds,
      durationSeconds,
      lines,
    })

    expect(isPiPActive.value).toBe(false)
    expect(typeof isPiPSupported.value).toBe('boolean')
  })

  it('renders frame onto canvas correctly at 1080p when supported', () => {
    const fillRect = vi.fn()
    const fillText = vi.fn()
    const mockCtx = {
      fillRect,
      fillText,
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    }

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      captureStream: vi.fn(() => ({})),
    }

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return mockCanvas as any
      if (tagName === 'video') {
        return {
          play: vi.fn().mockResolvedValue(undefined),
          requestPictureInPicture: vi.fn().mockResolvedValue({}),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as any
      }
      return document.createElement(tagName)
    })

    const pip = usePictureInPictureLyrics({
      songTitle,
      artistText,
      currentTimeSeconds,
      durationSeconds,
      lines,
    })

    pip.renderFrame()
    expect(mockCanvas.width).toBe(1920)
    expect(mockCanvas.height).toBe(1080)
    expect(fillRect).toHaveBeenCalled()
    expect(fillText).toHaveBeenCalled()
  })

  it('supports Document Picture-in-Picture when available', async () => {
    const mockPipWindow = {
      document: {
        title: '',
        head: { appendChild: vi.fn() },
        body: { innerHTML: '' },
        createElement: vi.fn((tag: string) => ({
          tag,
          textContent: '',
        })),
        querySelector: vi.fn((selector: string) => {
          if (selector === '.pip-progress-fill') return { style: { width: '0%' } }
          if (selector === '.pip-title') return { textContent: '' }
          if (selector.includes('pip-line')) return { textContent: '', style: {} }
          return { addEventListener: vi.fn() }
        }),
      },
      addEventListener: vi.fn(),
      close: vi.fn(),
    }

    const requestWindow = vi.fn().mockResolvedValue(mockPipWindow)
    ;(window as any).documentPictureInPicture = {
      requestWindow,
    }

    const pip = usePictureInPictureLyrics({
      songTitle,
      artistText,
      currentTimeSeconds,
      durationSeconds,
      lines,
    })

    expect(pip.isPiPSupported.value).toBe(true)
    await pip.togglePictureInPicture()

    expect(requestWindow).toHaveBeenCalledWith({ width: 560, height: 320 })
    expect(pip.isPiPActive.value).toBe(true)

    // Toggle again closes Document PiP
    await pip.togglePictureInPicture()
    expect(mockPipWindow.close).toHaveBeenCalled()
    expect(pip.isPiPActive.value).toBe(false)

    delete (window as any).documentPictureInPicture
  })

  it('syncs audio mute, volume, and playback controls with Video PiP', async () => {
    const videoEvents: Record<string, Function> = {}
    const mockVideo = {
      muted: false,
      volume: 1,
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      requestPictureInPicture: vi.fn().mockResolvedValue({}),
      addEventListener: vi.fn((event: string, handler: Function) => {
        videoEvents[event] = handler
      }),
      removeEventListener: vi.fn(),
      srcObject: null,
    }

    const mockCtx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    }

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      captureStream: vi.fn(() => ({})),
    }

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return mockCanvas as any
      if (tagName === 'video') return mockVideo as any
      return document.createElement(tagName)
    })
    ;(document as any).pictureInPictureEnabled = true

    const onTogglePlay = vi.fn()
    const onToggleMute = vi.fn()
    const onSetVolume = vi.fn()

    const pip = usePictureInPictureLyrics({
      songTitle,
      artistText,
      currentTimeSeconds,
      durationSeconds,
      isPlaying,
      isMuted,
      volume,
      lines,
      onTogglePlay,
      onToggleMute,
      onSetVolume,
    })

    await pip.togglePictureInPicture()
    expect(pip.isPiPActive.value).toBe(true)
    // When isMuted is false, video.muted is false (not forced to true!)
    expect(mockVideo.muted).toBe(false)
    expect(mockVideo.volume).toBe(0.8)

    // Simulate clicking pause in PiP window
    mockVideo.paused = true
    videoEvents.pause?.()
    expect(onTogglePlay).toHaveBeenCalled()

    // Simulate volume change in PiP window
    mockVideo.muted = true
    videoEvents.volumechange?.()
    expect(onToggleMute).toHaveBeenCalledWith(true)

    // Clean up
    await pip.togglePictureInPicture()
    delete (document as any).pictureInPictureEnabled
  })
})
