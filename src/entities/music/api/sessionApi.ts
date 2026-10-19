import { apiPostJson, apiGetOptional } from '@/api/client'

export interface PlaybackSessionDTO {
  song_id: string
  position: number
  queue?: string[]
}

export async function saveMusicProgress(songId: string, positionMs: number): Promise<void> {
  await apiPostJson('/api/v1/music/progress', { song_id: songId, position: positionMs })
}

export async function restoreMusicSession(): Promise<PlaybackSessionDTO | null> {
  return apiGetOptional<PlaybackSessionDTO>('/api/v1/music/session')
}

export async function fetchSessionRecommendation(context?: Record<string, string>): Promise<unknown> {
  const query = context && Object.keys(context).length > 0 ? `?${new URLSearchParams(context).toString()}` : ''
  return apiGetOptional<unknown>(`/api/v1/music/recommendations/session${query}`)
}

export async function reportSessionFeedback(feedback: Record<string, unknown>): Promise<void> {
  await apiPostJson('/api/v1/music/recommendations/feedback', feedback)
}
