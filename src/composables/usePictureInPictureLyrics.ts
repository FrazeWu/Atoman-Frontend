import { ref, computed, watch, effectScope, type Ref, type EffectScope } from 'vue'
import { getActivePinia } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { parseLrcLyrics, parsePlainLyrics } from '@/utils/musicLyrics'

export interface PictureInPictureLyricsOptions {
  songTitle: Ref<string>
  artistText: Ref<string>
  currentTimeSeconds: Ref<number>
  durationSeconds?: Ref<number>
  isPlaying?: Ref<boolean>
  volume?: Ref<number>
  isMuted?: Ref<boolean>
  lines: Ref<Array<{ text: string; translation?: string; startTimeMs?: number; time_ms?: number }>>
  onTogglePlay?: () => void
  onPrev?: () => void
  onNext?: () => void
  onToggleMute?: (muted: boolean) => void
  onSetVolume?: (volume: number) => void
  onSeek?: (timeSeconds: number) => void
}

interface DocumentPictureInPictureOptions {
  width?: number
  height?: number
  disallowReturnToOpener?: boolean
}

interface DocumentPictureInPicture {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>
  window?: Window | null
}

// Module-level singleton state to keep PiP active across component lifecycles
const isPiPActive = ref(false)
let docPiPWindow: Window | null = null
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let video: HTMLVideoElement | null = null
let pipScope: EffectScope | null = null
let currentOptions: PictureInPictureLyricsOptions | null = null

function getDocPiP(): DocumentPictureInPicture | null {
  if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
    return (window as unknown as { documentPictureInPicture: DocumentPictureInPicture }).documentPictureInPicture
  }
  return null
}

function getPlayer() {
  if (typeof window !== 'undefined' && getActivePinia()) {
    try {
      return usePlayerStore()
    } catch {
      return null
    }
  }
  return null
}

function getEffectiveTitle(opt: PictureInPictureLyricsOptions | null): string {
  if (opt?.songTitle?.value) return opt.songTitle.value
  const p = getPlayer()
  return p?.currentSong?.title || '未知曲目'
}

function getEffectiveArtist(opt: PictureInPictureLyricsOptions | null): string {
  if (opt?.artistText?.value) return opt.artistText.value
  const p = getPlayer()
  if (!p?.currentSong) return ''
  const artist = (p.currentSong as Record<string, unknown>).artist
  if (typeof artist === 'string' && artist) return artist
  const artists = (p.currentSong as Record<string, unknown>).artists
  if (Array.isArray(artists) && artists.length) {
    return artists.map((a: { name?: string }) => a.name).filter(Boolean).join(' / ')
  }
  return ''
}

function getEffectiveCurrentTime(opt: PictureInPictureLyricsOptions | null): number {
  if (typeof opt?.currentTimeSeconds?.value === 'number') return opt.currentTimeSeconds.value
  const p = getPlayer()
  return p?.currentTime ?? 0
}

function getEffectiveDuration(opt: PictureInPictureLyricsOptions | null): number {
  if (typeof opt?.durationSeconds?.value === 'number') return opt.durationSeconds.value
  const p = getPlayer()
  return p?.duration ?? 0
}

function getEffectiveIsPlaying(opt: PictureInPictureLyricsOptions | null): boolean {
  if (typeof opt?.isPlaying?.value === 'boolean') return opt.isPlaying.value
  const p = getPlayer()
  return p?.isPlaying ?? false
}

function getEffectiveIsMuted(opt: PictureInPictureLyricsOptions | null): boolean {
  if (typeof opt?.isMuted?.value === 'boolean') return opt.isMuted.value
  const p = getPlayer()
  return p?.isMuted ?? false
}

function getEffectiveVolume(opt: PictureInPictureLyricsOptions | null): number {
  if (typeof opt?.volume?.value === 'number') return opt.volume.value
  const p = getPlayer()
  return p?.volume ?? 1
}

function getEffectiveLines(opt: PictureInPictureLyricsOptions | null) {
  if (opt?.lines?.value && opt.lines.value.length > 0) {
    return opt.lines.value
  }
  const p = getPlayer()
  const raw = p?.currentSong?.lyrics
  if (raw && typeof raw === 'string') {
    const parsed = parseLrcLyrics(raw)
    if (parsed.length > 0) {
      return parsed.map((item) => ({
        text: item.text,
        translation: item.translation || '',
        startTimeMs: item.startTimeMs ?? undefined,
        time_ms: item.startTimeMs ?? undefined,
      }))
    }
    const plain = parsePlainLyrics(raw)
    return plain.map((item) => ({
      text: item.text,
      translation: item.translation || '',
      startTimeMs: item.startTimeMs ?? undefined,
      time_ms: item.startTimeMs ?? undefined,
    }))
  }
  return []
}

function handleTogglePlay() {
  if (currentOptions?.onTogglePlay) {
    currentOptions.onTogglePlay()
  } else {
    getPlayer()?.togglePlay()
  }
}

function handlePrev() {
  if (currentOptions?.onPrev) {
    currentOptions.onPrev()
  } else {
    getPlayer()?.playPrevious()
  }
}

function handleNext() {
  if (currentOptions?.onNext) {
    currentOptions.onNext()
  } else {
    getPlayer()?.playNext()
  }
}

function handleToggleMute(muted: boolean) {
  if (currentOptions?.onToggleMute) {
    currentOptions.onToggleMute(muted)
  } else {
    const p = getPlayer()
    if (p) {
      if (muted && !p.isMuted) p.toggleMute()
      else if (!muted && p.isMuted) p.toggleMute()
    }
  }
}

function handleSetVolume(vol: number) {
  if (currentOptions?.onSetVolume) {
    currentOptions.onSetVolume(vol)
  } else {
    getPlayer()?.setVolume(vol)
  }
}

function handleSeek(timeSeconds: number) {
  if (currentOptions?.onSeek) {
    currentOptions.onSeek(timeSeconds)
  } else {
    getPlayer()?.seek(timeSeconds)
  }
}

function initDocumentPiPDOM(pipWin: Window) {
  const doc = pipWin.document
  doc.title = `${getEffectiveTitle(currentOptions)} - 画中画歌词`

  const style = doc.createElement('style')
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0b0f19;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      user-select: none;
      -webkit-font-smoothing: antialiased;
    }
    .pip-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 14px 18px 12px;
      justify-content: space-between;
    }
    .pip-header {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 0;
      gap: 6px;
    }
    .pip-title {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 90%;
    }
    .pip-lyrics-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 10px;
      min-height: 0;
      padding: 6px 0;
    }
    .pip-line {
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 10px;
      transition: all 0.22s ease-out;
    }
    .pip-line--prev,
    .pip-line--next {
      font-size: 14px;
      color: rgba(148, 163, 184, 0.45);
      font-weight: 500;
    }
    .pip-line--current {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
      letter-spacing: -0.01em;
    }
    .pip-line--trans {
      font-size: 14px;
      color: #93c5fd;
      font-weight: 500;
      margin-top: -4px;
    }
    .pip-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pip-progress-track {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
    }
    .pip-progress-fill {
      height: 100%;
      width: 0%;
      background: #3b82f6;
      border-radius: 9999px;
      transition: width 0.12s linear;
    }
    .pip-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .pip-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      transition: background-color 0.15s, color 0.15s, transform 0.1s;
      outline: none;
    }
    .pip-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
    .pip-btn:active {
      transform: scale(0.92);
    }
    .pip-btn--play {
      width: 38px;
      height: 38px;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }
    .pip-btn--play:hover {
      background: rgba(255, 255, 255, 0.22);
    }
  `
  doc.head.appendChild(style)

  doc.body.innerHTML = `
    <div class="pip-root">
      <div class="pip-header">
        <span class="pip-title"></span>
      </div>
      <div class="pip-lyrics-area">
        <div class="pip-line pip-line--prev"></div>
        <div class="pip-line pip-line--current"></div>
        <div class="pip-line pip-line--trans" style="display: none;"></div>
        <div class="pip-line pip-line--next"></div>
      </div>
      <div class="pip-footer">
        <div class="pip-progress-track">
          <div class="pip-progress-fill"></div>
        </div>
        <div class="pip-controls">
          <button type="button" class="pip-btn pip-btn--prev" title="上一首" aria-label="上一首">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg>
          </button>
          <button type="button" class="pip-btn pip-btn--play" title="播放/暂停" aria-label="播放/暂停">
            <svg class="pip-icon-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <svg class="pip-icon-pause" style="display:none;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <button type="button" class="pip-btn pip-btn--next" title="下一首" aria-label="下一首">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
          </button>
        </div>
      </div>
    </div>
  `

  const prevBtn = doc.querySelector('.pip-btn--prev') as HTMLButtonElement
  const playBtn = doc.querySelector('.pip-btn--play') as HTMLButtonElement
  const nextBtn = doc.querySelector('.pip-btn--next') as HTMLButtonElement
  const progressTrack = doc.querySelector('.pip-progress-track') as HTMLDivElement

  prevBtn?.addEventListener('click', () => handlePrev())
  playBtn?.addEventListener('click', () => handleTogglePlay())
  nextBtn?.addEventListener('click', () => handleNext())

  progressTrack?.addEventListener('click', (e: MouseEvent) => {
    const rect = progressTrack.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const dur = getEffectiveDuration(currentOptions)
    if (dur > 0) {
      handleSeek(dur * pct)
    }
  })
}

function updateDocumentPiP(pipWin: Window) {
  const doc = pipWin.document
  const titleEl = doc.querySelector('.pip-title')
  const prevEl = doc.querySelector('.pip-line--prev')
  const curEl = doc.querySelector('.pip-line--current')
  const transEl = doc.querySelector('.pip-line--trans') as HTMLElement | null
  const nextEl = doc.querySelector('.pip-line--next')
  const fillEl = doc.querySelector('.pip-progress-fill') as HTMLElement | null
  const playIcon = doc.querySelector('.pip-icon-play') as HTMLElement | null
  const pauseIcon = doc.querySelector('.pip-icon-pause') as HTMLElement | null

  // Header
  const title = getEffectiveTitle(currentOptions)
  const artist = getEffectiveArtist(currentOptions)
  if (titleEl) titleEl.textContent = artist ? `${title} · ${artist}` : title

  // Current lyric line calculation
  const currentMs = getEffectiveCurrentTime(currentOptions) * 1000
  const list = getEffectiveLines(currentOptions)
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
  if (prevEl) {
    prevEl.textContent = (currentIndex > 0 && list[currentIndex - 1]) ? list[currentIndex - 1].text : ''
  }

  // Current line
  if (curEl) {
    if (currentIndex >= 0 && list[currentIndex]) {
      curEl.textContent = list[currentIndex].text
    } else {
      curEl.textContent = list.length ? '' : '♪ 聆听音乐 ♪'
    }
  }

  // Translation
  if (transEl) {
    if (currentIndex >= 0 && list[currentIndex]?.translation) {
      transEl.textContent = list[currentIndex].translation!
      if (transEl.style) transEl.style.display = 'block'
    } else {
      transEl.textContent = ''
      if (transEl.style) transEl.style.display = 'none'
    }
  }

  // Next line
  if (nextEl) {
    nextEl.textContent = (currentIndex >= 0 && currentIndex + 1 < list.length && list[currentIndex + 1])
      ? list[currentIndex + 1].text
      : ''
  }

  // Progress
  const duration = getEffectiveDuration(currentOptions)
  const currentTime = getEffectiveCurrentTime(currentOptions)
  if (fillEl && fillEl.style) {
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
    fillEl.style.width = `${(progress * 100).toFixed(2)}%`
  }

  // Play/Pause icon
  const isPlaying = getEffectiveIsPlaying(currentOptions)
  if (playIcon && pauseIcon && playIcon.style && pauseIcon.style) {
    if (isPlaying) {
      playIcon.style.display = 'none'
      pauseIcon.style.display = 'block'
    } else {
      playIcon.style.display = 'block'
      pauseIcon.style.display = 'none'
    }
  }
}

function drawFittedText(
  targetCtx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxFontSize: number,
  weight: number | string,
  color: string,
  maxWidth = 1760
) {
  let size = maxFontSize
  targetCtx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  const measured = typeof targetCtx.measureText === 'function' ? targetCtx.measureText(text).width : text.length * (size * 0.6)
  if (measured > maxWidth && maxWidth > 0) {
    size = Math.max(28, Math.floor(size * (maxWidth / measured)))
    targetCtx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  }
  targetCtx.fillStyle = color
  targetCtx.fillText(text, x, y)
}

function initCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  ctx = canvas.getContext('2d')
}

function renderCanvasFrame() {
  if (!ctx || !canvas) return

  // Background
  ctx.fillStyle = '#0b0f19'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Top subtle accent bar
  ctx.fillStyle = '#3b82f6'
  ctx.fillRect(0, 0, canvas.width, 6)

  // Header: Song Title & Artist
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const title = getEffectiveTitle(currentOptions)
  const artist = getEffectiveArtist(currentOptions)
  const headerText = artist ? `${title} · ${artist}` : title
  drawFittedText(ctx, headerText, canvas.width / 2, 110, 36, 600, '#94a3b8', 1600)

  // Find current line index
  const currentMs = getEffectiveCurrentTime(currentOptions) * 1000
  const list = getEffectiveLines(currentOptions)
  let currentIndex = -1

  for (let i = 0; i < list.length; i++) {
    const lineTime = list[i].startTimeMs ?? list[i].time_ms ?? 0
    if (lineTime <= currentMs) {
      currentIndex = i
    } else {
      break
    }
  }

  const hasTranslation = Boolean(currentIndex >= 0 && list[currentIndex]?.translation)

  if (hasTranslation) {
    // Previous line
    if (currentIndex > 0 && list[currentIndex - 1]) {
      drawFittedText(ctx, list[currentIndex - 1].text, canvas.width / 2, 380, 42, 500, 'rgba(148, 163, 184, 0.45)', 1700)
    }

    // Current line & translation
    if (currentIndex >= 0 && list[currentIndex]) {
      drawFittedText(ctx, list[currentIndex].text, canvas.width / 2, 510, 64, 700, '#ffffff', 1760)
      drawFittedText(ctx, list[currentIndex].translation!, canvas.width / 2, 590, 40, 500, '#93c5fd', 1700)
    }

    // Next line
    if (currentIndex >= 0 && currentIndex + 1 < list.length && list[currentIndex + 1]) {
      drawFittedText(ctx, list[currentIndex + 1].text, canvas.width / 2, 720, 42, 500, 'rgba(148, 163, 184, 0.45)', 1700)
    }
  } else {
    // Symmetrical 100% vertical center: 540 is exact half of 1080
    // Previous line at 380 (540 - 160)
    if (currentIndex > 0 && list[currentIndex - 1]) {
      drawFittedText(ctx, list[currentIndex - 1].text, canvas.width / 2, 380, 44, 500, 'rgba(148, 163, 184, 0.45)', 1700)
    }

    // Current line at 540
    if (currentIndex >= 0 && list[currentIndex]) {
      drawFittedText(ctx, list[currentIndex].text, canvas.width / 2, 540, 68, 700, '#ffffff', 1760)
    } else {
      drawFittedText(ctx, list.length ? '' : '♪ 聆听音乐 ♪', canvas.width / 2, 540, 56, 600, 'rgba(255, 255, 255, 0.7)', 1700)
    }

    // Next line at 700 (540 + 160)
    if (currentIndex >= 0 && currentIndex + 1 < list.length && list[currentIndex + 1]) {
      drawFittedText(ctx, list[currentIndex + 1].text, canvas.width / 2, 700, 44, 500, 'rgba(148, 163, 184, 0.45)', 1700)
    }
  }

  // Bottom progress bar
  const duration = getEffectiveDuration(currentOptions)
  const currentTime = getEffectiveCurrentTime(currentOptions)
  if (duration > 0) {
    const progress = Math.min(1, Math.max(0, currentTime / duration))
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(80, canvas.height - 48, canvas.width - 160, 8)
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(80, canvas.height - 48, (canvas.width - 160) * progress, 8)
  }
}

function startSession(options: PictureInPictureLyricsOptions) {
  stopSession()
  pipScope = effectScope(true)
  pipScope.run(() => {
    const update = () => {
      if (!isPiPActive.value) return
      if (docPiPWindow) {
        updateDocumentPiP(docPiPWindow)
      } else if (canvas && ctx) {
        renderCanvasFrame()
      }
    }

    const watchTargets = [
      options.currentTimeSeconds,
      options.songTitle,
      options.lines,
      ...(options.durationSeconds ? [options.durationSeconds] : []),
      ...(options.isPlaying ? [options.isPlaying] : []),
    ]

    watch(watchTargets, update, { flush: 'post' })

    if (options.isPlaying) {
      watch(options.isPlaying, (playing) => {
        if (video && isPiPActive.value) {
          if (playing && video.paused) {
            video.play().catch(() => undefined)
          } else if (!playing && !video.paused) {
            video.pause()
          }
        }
      })
    }

    if (options.isMuted) {
      watch(options.isMuted, (muted) => {
        if (video && isPiPActive.value && typeof muted === 'boolean') {
          video.muted = muted
        }
      })
    }

    if (options.volume) {
      watch(options.volume, (vol) => {
        if (video && isPiPActive.value && typeof vol === 'number') {
          video.volume = vol
        }
      })
    }
  })
}

function stopSession() {
  if (pipScope) {
    pipScope.stop()
    pipScope = null
  }
}

async function closePictureInPicture() {
  stopSession()
  if (docPiPWindow) {
    try {
      docPiPWindow.close()
    } catch {
      // ignore
    }
    docPiPWindow = null
  }
  if (typeof document !== 'undefined' && document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => undefined)
  }
  if (video) {
    video.pause()
    video.srcObject = null
    video = null
  }
  canvas = null
  ctx = null
  isPiPActive.value = false
}

export function usePictureInPictureLyrics(options: PictureInPictureLyricsOptions) {
  currentOptions = options

  const isDocPiPSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window
  const isVideoPiPSupported =
    typeof document !== 'undefined' &&
    Boolean(document.pictureInPictureEnabled) &&
    typeof HTMLCanvasElement !== 'undefined'

  const isPiPSupported = computed(() => isDocPiPSupported || isVideoPiPSupported)

  const togglePictureInPicture = async () => {
    if (!isPiPSupported.value) return

    if (isPiPActive.value) {
      await closePictureInPicture()
      return
    }

    // 1. Prefer modern Document Picture-in-Picture (Chrome 116+ / Edge)
    if (isDocPiPSupported) {
      const docPiP = getDocPiP()
      if (docPiP) {
        try {
          const pipWin = await docPiP.requestWindow({
            width: 560,
            height: 320,
          })
          docPiPWindow = pipWin
          isPiPActive.value = true

          initDocumentPiPDOM(pipWin)
          updateDocumentPiP(pipWin)

          pipWin.addEventListener('pagehide', () => {
            docPiPWindow = null
            isPiPActive.value = false
            stopSession()
          })

          startSession(options)
          return
        } catch {
          // If Document PiP fails, gracefully fall through to Canvas PiP
        }
      }
    }

    // 2. Fall back to Canvas + Video PiP (Safari, Firefox, etc.)
    initCanvas()
    renderCanvasFrame()

    if (!video) {
      video = document.createElement('video')
      video.playsInline = true
      video.muted = getEffectiveIsMuted(options)
      video.volume = getEffectiveVolume(options)

      if (canvas && typeof canvas.captureStream === 'function') {
        const stream = canvas.captureStream(15)
        try {
          video.srcObject = stream
        } catch {
          // ignore mock / test environment MediaStream type error
        }
      }

      video.addEventListener('leavepictureinpicture', () => {
        isPiPActive.value = false
        stopSession()
      })

      video.addEventListener('volumechange', () => {
        if (!video) return
        handleToggleMute(video.muted)
        handleSetVolume(video.volume)
      })

      video.addEventListener('pause', () => {
        if (isPiPActive.value && getEffectiveIsPlaying(options)) {
          handleTogglePlay()
        }
      })

      video.addEventListener('play', () => {
        if (isPiPActive.value && !getEffectiveIsPlaying(options)) {
          handleTogglePlay()
        }
      })
    }

    try {
      try {
        await video.play()
      } catch {
        video.muted = true
        await video.play()
      }
      await video.requestPictureInPicture()
      isPiPActive.value = true
      renderCanvasFrame()
      startSession(options)
    } catch {
      isPiPActive.value = false
      stopSession()
    }
  }

  const renderFrame = () => {
    initCanvas()
    renderCanvasFrame()
  }

  return {
    isPiPActive,
    isPiPSupported,
    togglePictureInPicture,
    renderFrame,
  }
}
