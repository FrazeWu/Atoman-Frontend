import type { Song } from '@/types'
import { hasPlayableMusicAudio } from '@/utils/musicMedia'

export const CURRENT_PLAYBACK_STATE_VERSION = 1
export const PLAYBACK_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days TTL
export const PLAYBACK_PROGRESS_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours for song progress
export const MIN_PERSIST_RESUME_SECONDS = 3
export const NEAR_END_PERSIST_SECONDS = 3

export type PersistedPlaybackState = {
  version?: number
  savedAt?: number
  song?: Song | null
  queue?: Song[]
  currentTime?: number
  volume?: number
  isShuffled?: boolean
  repeatMode?: string
  playbackMode?: string
}

export function normalizePlaybackSong(song: Song, resolveAudioURL: (url: string) => string): Song {
  return { ...song, audio_url: resolveAudioURL(song.audio_url) }
}

export function hasPlayableAudio(song: Song | null | undefined): boolean {
  if (!song) return false
  if (song.source_type && song.source_type !== 'music') {
    return Boolean(song.audio_url?.trim())
  }
  return hasPlayableMusicAudio(song)
}

export function compactPlaybackSong(song: Song): Song {
  const { lyrics: _lyrics, waveform_peaks: _waveformPeaks, ...compact } = song
  return compact as Song
}

export function playbackItemKey(song: Song) {
  const sourceType = song.source_type || 'music'
  return `${sourceType}:${song.source_id || song.id}`
}

/**
 * 校验已持久化的状态是否已整体过期（超过 7 天）
 */
export function isPlaybackStateExpired(state: PersistedPlaybackState, now = Date.now()): boolean {
  if (typeof state.savedAt === 'number' && state.savedAt > 0) {
    return now - state.savedAt > PLAYBACK_STATE_MAX_AGE_MS
  }
  return false
}

/**
 * 校验持久化的进度时间戳是否已超过 24 小时（普通歌曲若隔天重开则进度归零）
 */
export function isPlaybackProgressStale(state: PersistedPlaybackState, now = Date.now()): boolean {
  if (typeof state.savedAt === 'number' && state.savedAt > 0) {
    return now - state.savedAt > PLAYBACK_PROGRESS_MAX_AGE_MS
  }
  return false
}

/**
 * 规范化断点续播进度（防片头尴尬中断，防片尾即将结束时重新加载跳歌）
 */
export function sanitizeResumePosition(currentTime: number, duration: number, isPodcast = false): number {
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0
  if (isPodcast) return Math.max(0, currentTime)

  // 歌曲前 3 秒自动归零
  if (currentTime < MIN_PERSIST_RESUME_SECONDS) return 0

  // 歌曲尾声（剩余不到 3 秒或进度超过 98%）视为已听完，归零
  if (duration > 0) {
    if (currentTime >= duration - NEAR_END_PERSIST_SECONDS) return 0
    if (currentTime / duration >= 0.98) return 0
  }

  return currentTime
}

/**
 * 检验 localStorage 中的 raw 字符串是否包含有效且未过期的播放会话
 */
export function hasPersistedPlayableState(raw: string | null): boolean {
  if (!raw) return false
  try {
    const state = JSON.parse(raw) as PersistedPlaybackState
    if (!state || isPlaybackStateExpired(state)) return false
    return Boolean(state.song?.id && state.song?.audio_url?.trim())
  } catch {
    return false
  }
}
