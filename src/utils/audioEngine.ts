export const audioStartPrefetchBytes = 512 * 1024
export const audioStartPrefetchConcurrency = 4

export const computeActualVolume = (v: number): number => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1))
  return Math.pow(clamped, 2)
}

export const fadeOutAudio = async (targetAudio: HTMLAudioElement, durationMs = 120): Promise<void> => {
  if (!targetAudio || targetAudio.paused || targetAudio.volume <= 0) return
  const steps = 6
  const interval = Math.max(10, Math.floor(durationMs / steps))
  const initialVolume = targetAudio.volume
  for (let i = 1; i <= steps; i++) {
    targetAudio.volume = Math.max(0, initialVolume * (1 - i / steps))
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

export function resolvePlaybackAudioUrl(url: string): string {
  if (!url) return ''
  if (url.includes('.r2.cloudflarestorage.com') || url.includes('assets.atoman.org')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}cors=1`
  }
  return url
}

export class AudioPrefetcher {
  private prefetchedUrls = new Set<string>()
  private abortController: AbortController | null = null

  public isPrefetched(url: string): boolean {
    return this.prefetchedUrls.has(url)
  }

  public markPrefetched(url: string): void {
    this.prefetchedUrls.add(url)
  }

  public getAbortSignal(): AbortSignal {
    if (!this.abortController) {
      this.abortController = new AbortController()
    }
    return this.abortController.signal
  }

  public abortPending(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  public reset(): void {
    this.abortPending()
    this.prefetchedUrls.clear()
  }
}
