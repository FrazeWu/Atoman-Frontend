export interface VideoProgressRecord {
  time_sec: number
  duration_sec: number
  updated_at: string
}

function progressKey(videoId: string) {
  return `atoman:video-progress:${videoId}`
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getVideoProgress(videoId: string): VideoProgressRecord | null {
  const storage = getLocalStorage()
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(progressKey(videoId))
  } catch {
    return null
  }

  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as VideoProgressRecord
    if (!Number.isFinite(parsed.time_sec) || parsed.time_sec <= 0) return null
    if (!Number.isFinite(parsed.duration_sec) || parsed.duration_sec <= 0) return null
    if (typeof parsed.updated_at !== 'string' || !parsed.updated_at) return null
    if (!Number.isFinite(Date.parse(parsed.updated_at))) return null
    return parsed
  } catch {
    return null
  }
}

export function saveVideoProgress(videoId: string, timeSec: number, durationSec: number) {
  const storage = getLocalStorage()
  if (!storage) return

  const time = Math.max(0, Math.floor(timeSec))
  const duration = Math.max(0, Math.floor(durationSec))
  if (time <= 0) {
    clearVideoProgress(videoId)
    return
  }
  if (!duration || time >= Math.max(0, duration - 5)) {
    clearVideoProgress(videoId)
    return
  }
  const record: VideoProgressRecord = {
    time_sec: time,
    duration_sec: duration,
    updated_at: new Date().toISOString(),
  }
  try {
    storage.setItem(progressKey(videoId), JSON.stringify(record))
  } catch {
    // Storage can be disabled or full; progress persistence is best-effort.
  }
}

export function clearVideoProgress(videoId: string) {
  const storage = getLocalStorage()
  if (!storage) return

  try {
    storage.removeItem(progressKey(videoId))
  } catch {
    // Ignore unavailable storage; clearing progress should never block playback.
  }
}
