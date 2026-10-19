export type MusicPlayerShortcut =
  | 'lyrics'
  | 'toggle-play'
  | 'previous'
  | 'next'
  | 'skip-back'
  | 'skip-forward'
  | 'volume-up'
  | 'volume-down'
  | 'mute'

export function resolveMusicPlayerShortcut(event: KeyboardEvent): MusicPlayerShortcut | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) return null

  const key = event.key.toLowerCase()
  if (event.shiftKey && !event.altKey && key === 'f') return 'lyrics'
  if (event.shiftKey) return null

  if (event.altKey) {
    if (event.key === 'ArrowLeft') return 'previous'
    if (event.key === 'ArrowRight') return 'next'
    return null
  }

  if (event.key === ' ' || event.code === 'Space') return 'toggle-play'
  if (event.key === 'ArrowLeft') return 'skip-back'
  if (event.key === 'ArrowRight') return 'skip-forward'
  if (event.key === 'ArrowUp') return 'volume-up'
  if (event.key === 'ArrowDown') return 'volume-down'
  if (key === 'm') return 'mute'
  return null
}
