import {
  saveMusicPlaybackProgress,
  getMusicPlaybackSession,
  type SaveMusicPlaybackProgressInput,
  type MusicPlaybackSession,
} from '@/api/musicV1'

export async function saveMusicProgress(
  input: SaveMusicPlaybackProgressInput,
): Promise<void> {
  await saveMusicPlaybackProgress(input)
}

export async function restoreMusicSession(): Promise<MusicPlaybackSession | null> {
  return getMusicPlaybackSession()
}
