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
  // A full playlist can contain hundreds of songs: only fetch a few upcoming
  // audio prefixes, beginning AFTER the current song, instead of the entire queue.
  const itemKey = (song: Song) =>
    String(song.source_type || 'music') + ':' + String(song.source_id || song.id)
  const currentIndex = queue.findIndex((song) => itemKey(song) === currentKey)
  const upcoming = currentIndex < 0
    ? queue
    : [...queue.slice(currentIndex + 1), ...queue.slice(0, currentIndex)]

  return [...new Set(
    upcoming
      .filter((song) => itemKey(song) !== currentKey)
      .filter(canPlay)
      .map((song) => resolveAudioURL(song.audio_url))
      .filter((url) => !prefetchedURLs.has(url)),
  )].slice(0, 3)
}
