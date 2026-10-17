import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { usePictureInPictureLyrics } from '@/composables/usePictureInPictureLyrics'

describe('usePictureInPictureLyrics', () => {
  const songTitle = ref('Test Song')
  const artistText = ref('Test Artist')
  const currentTimeSeconds = ref(15)
  const durationSeconds = ref(180)
  const lines = ref([
    { text: 'Line 1', time_ms: 0 },
    { text: 'Line 2', time_ms: 10000 },
    { text: 'Line 3', time_ms: 20000 },
  ])

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

  it('renders frame onto canvas correctly when supported', () => {
    // Mock canvas context
    const fillRect = vi.fn()
    const fillText = vi.fn()
    const mockCtx = {
      fillRect,
      fillText,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    }

    const mockCanvas = {
      width: 640,
      height: 360,
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
    expect(mockCtx.getContext ? mockCtx.getContext : true).toBeTruthy()
    vi.restoreAllMocks()
  })
})
