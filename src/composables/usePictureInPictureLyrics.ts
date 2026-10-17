import { ref, watch, onBeforeUnmount, getCurrentInstance, type Ref } from 'vue'

export interface PictureInPictureLyricsOptions {
  songTitle: Ref<string>
  artistText: Ref<string>
  currentTimeSeconds: Ref<number>
  durationSeconds?: Ref<number>
  lines: Ref<Array<{ text: string; translation?: string; startTimeMs?: number; time_ms?: number }>>
}

export function usePictureInPictureLyrics(options: PictureInPictureLyricsOptions) {
  const isPiPActive = ref(false)
  const isPiPSupported = ref(
    typeof document !== 'undefined' &&
    Boolean(document.pictureInPictureEnabled) &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )

  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let video: HTMLVideoElement | null = null

  const initCanvas = () => {
    if (canvas) return
    canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    ctx = canvas.getContext('2d')
  }

  const renderFrame = () => {
    if (!ctx || !canvas) return

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Top subtle bar / brand notch
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(0, 0, canvas.width, 4)

    // Song Title & Artist
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const title = options.songTitle.value || '未知曲目'
    const artist = options.artistText.value ? ` · ${options.artistText.value}` : ''
    ctx.fillText(`${title}${artist}`, canvas.width / 2, 40)

    // Find current line index
    const currentMs = options.currentTimeSeconds.value * 1000
    const list = options.lines.value || []
    let currentIndex = -1

    for (let i = 0; i < list.length; i++) {
      const lineTime = list[i].startTimeMs ?? list[i].time_ms ?? 0
      if (lineTime <= currentMs) {
        currentIndex = i
      } else {
        break
      }
    }

    // Previous line
    if (currentIndex > 0 && list[currentIndex - 1]) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(list[currentIndex - 1].text, canvas.width / 2, 115)
    }

    // Current line (active, enlarged, bright)
    if (currentIndex >= 0 && list[currentIndex]) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(list[currentIndex].text, canvas.width / 2, 180)

      // Translation if available
      if (list[currentIndex].translation) {
        ctx.fillStyle = '#93c5fd'
        ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(list[currentIndex].translation!, canvas.width / 2, 220)
      }
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('♪ 聆听音乐 ♪', canvas.width / 2, 180)
    }

    // Next line
    if (currentIndex >= 0 && currentIndex + 1 < list.length && list[currentIndex + 1]) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(list[currentIndex + 1].text, canvas.width / 2, 265)
    }

    // Bottom progress line
    if (options.durationSeconds && options.durationSeconds.value > 0) {
      const progress = Math.min(1, Math.max(0, options.currentTimeSeconds.value / options.durationSeconds.value))
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(40, canvas.height - 24, canvas.width - 80, 4)
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(40, canvas.height - 24, (canvas.width - 80) * progress, 4)
    }
  }

  const togglePictureInPicture = async () => {
    if (!isPiPSupported.value) return

    if (isPiPActive.value) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => undefined)
      }
      isPiPActive.value = false
      return
    }

    initCanvas()
    renderFrame()

    if (!video) {
      video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      const stream = canvas!.captureStream(15)
      video.srcObject = stream
      video.addEventListener('leavepictureinpicture', () => {
        isPiPActive.value = false
      })
    }

    try {
      await video.play()
      await video.requestPictureInPicture()
      isPiPActive.value = true
      renderFrame()
    } catch {
      isPiPActive.value = false
    }
  }

  watch(
    [options.currentTimeSeconds, options.songTitle, options.lines],
    () => {
      if (isPiPActive.value) {
        renderFrame()
      }
    },
    { flush: 'post' }
  )

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (isPiPActive.value && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => undefined)
      }
      if (video) {
        video.srcObject = null
        video = null
      }
      canvas = null
      ctx = null
    })
  }

  return {
    isPiPActive,
    isPiPSupported,
    togglePictureInPicture,
    renderFrame,
  }
}
