import type { Song } from '@/types'

export function shufflePlaybackItems<T>(items: T[], random = Math.random) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

export function buildPrefetchCandidates(
  queue: Song[],
  currentKey: string,
  resolveAudioURL: (url: string) => string,
  canPlay: (song: Song) => boolean,
  prefetchedURLs: ReadonlySet<string>,
) {
  return [...new Set(
    queue
      .filter((song) => song.source_type ? `${song.source_type}:${song.source_id || song.id}` !== currentKey : `music:${song.source_id || song.id}` !== currentKey)
      .filter(canPlay)
      .map((song) => resolveAudioURL(song.audio_url))
      .filter((url) => !prefetchedURLs.has(url)),
  )]
}
