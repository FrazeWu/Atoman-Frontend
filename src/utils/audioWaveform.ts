const waveformMemoryCache = new Map<string, number[]>()
const waveformStoragePrefix = 'atoman:music-waveform:'
const maxWaveformAudioBytes = 48 * 1024 * 1024

type StoredWaveform = {
  audioUrl: string
  peaks: number[]
}

export function calculateWaveformPeaks(channels: Float32Array[], peakCount = 160): number[] {
  const validChannels = channels.filter((channel) => channel.length > 0)
  if (!validChannels.length || peakCount <= 0) return []

  const sampleLength = Math.max(...validChannels.map((channel) => channel.length))
  const blockSize = Math.max(1, Math.floor(sampleLength / peakCount))
  const rawPeaks = Array.from({ length: peakCount }, (_, index) => {
    const start = index * blockSize
    const end = index === peakCount - 1 ? sampleLength : Math.min(sampleLength, start + blockSize)
    let peak = 0
    for (const channel of validChannels) {
      const channelEnd = Math.min(channel.length, end)
      for (let sampleIndex = start; sampleIndex < channelEnd; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0))
      }
    }
    return peak
  })

  const sorted = [...rawPeaks].sort((left, right) => left - right)
  const referencePeak = sorted[Math.floor((sorted.length - 1) * 0.95)] || Math.max(...rawPeaks) || 1
  return rawPeaks.map((peak) => Math.max(0.08, Math.min(1, peak / referencePeak)))
}

export function generateWaveformPlaceholder(seed: string, peakCount = 160): number[] {
  if (peakCount <= 0) return []

  let state = 2166136261
  for (const character of seed) {
    state ^= character.charCodeAt(0)
    state = Math.imul(state, 16777619)
  }

  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967295
  }

  let previous = 0.35 + random() * 0.3
  return Array.from({ length: peakCount }, (_, index) => {
    const contour = 0.72 + Math.sin((index / Math.max(1, peakCount - 1)) * Math.PI) * 0.28
    const target = 0.18 + random() * 0.82
    previous = previous * 0.58 + target * 0.42
    return Math.max(0.1, Math.min(1, previous * contour))
  })
}

function storageKey(songId: string) {
  return `${waveformStoragePrefix}${songId}`
}

function readStoredWaveform(songId: string, audioUrl: string): number[] | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(songId))
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredWaveform
    if (stored.audioUrl !== audioUrl || !Array.isArray(stored.peaks) || stored.peaks.length === 0) return null
    return stored.peaks.filter((peak) => Number.isFinite(peak)).map((peak) => Math.max(0.08, Math.min(1, peak)))
  } catch {
    return null
  }
}

function storeWaveform(songId: string, audioUrl: string, peaks: number[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(songId), JSON.stringify({ audioUrl, peaks } satisfies StoredWaveform))
  } catch {
    // Waveform caching is best-effort and must never block playback.
  }
}

export async function loadAudioWaveform(
  songId: string,
  audioUrl: string,
  signal?: AbortSignal,
  peakCount = 160,
): Promise<number[]> {
  const cacheKey = `${songId}:${audioUrl}:${peakCount}`
  const memoryPeaks = waveformMemoryCache.get(cacheKey)
  if (memoryPeaks) return memoryPeaks

  const storedPeaks = readStoredWaveform(songId, audioUrl)
  if (storedPeaks?.length === peakCount) {
    waveformMemoryCache.set(cacheKey, storedPeaks)
    return storedPeaks
  }

  const response = await fetch(audioUrl, { signal })
  if (!response.ok) throw new Error(`waveform audio request failed: ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > maxWaveformAudioBytes) throw new Error('waveform audio is too large')

  const audioData = await response.arrayBuffer()
  if (audioData.byteLength > maxWaveformAudioBytes) throw new Error('waveform audio is too large')
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const AudioContextConstructor = window.AudioContext
  const audioContext = new AudioContextConstructor()
  try {
    const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0))
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index))
    const peaks = calculateWaveformPeaks(channels, peakCount)
    waveformMemoryCache.set(cacheKey, peaks)
    storeWaveform(songId, audioUrl, peaks)
    return peaks
  } finally {
    void audioContext.close()
  }
}
