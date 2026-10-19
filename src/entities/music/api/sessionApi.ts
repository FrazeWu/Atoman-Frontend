import { apiGetOptional, apiPostJson } from '@/api/client'
import {
  saveMusicPlaybackProgress,
  getMusicPlaybackSession,
  type SaveMusicPlaybackProgressInput,
  type MusicPlaybackSession,
} from '@/api/musicV1'

export interface PlaybackSessionDTO {
  song_id: string
  position: number
  queue?: string[]
}

export async function saveMusicProgress(
  songIdOrPayload: string | SaveMusicPlaybackProgressInput,
  positionMs?: number,
): Promise<void> {
  if (typeof songIdOrPayload === 'object') {
    await saveMusicPlaybackProgress(songIdOrPayload)
    return
  }
  await apiPostJson('/api/v1/music/progress', { song_id: songIdOrPayload, position: positionMs })
}

export async function restoreMusicSession(): Promise<MusicPlaybackSession | null> {
  return getMusicPlaybackSession()
}

export async function fetchSessionRecommendation(context?: Record<string, string>): Promise<unknown> {
  const query = context && Object.keys(context).length > 0 ? `?${new URLSearchParams(context).toString()}` : ''
  return apiGetOptional<unknown>(`/api/v1/music/recommendations/session${query}`)
}

export async function reportSessionFeedback(feedback: Record<string, unknown>): Promise<void> {
  await apiPostJson('/api/v1/music/recommendations/feedback', feedback)
}
