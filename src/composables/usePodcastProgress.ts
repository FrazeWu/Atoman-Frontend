export type PodcastProgressRecord = {
  episode_id: string
  position_sec: number
  duration_sec: number
  completed: boolean
  last_played_at: string
}

const keyFor = (episodeId: string) => `atoman:podcast-progress:${episodeId}`
const indexKey = 'atoman:podcast-progress:index'

export function readPodcastProgress(episodeId: string): PodcastProgressRecord | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(keyFor(episodeId))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PodcastProgressRecord>
    if (typeof value.position_sec !== 'number') return null
    return {
      episode_id: episodeId,
      position_sec: value.position_sec,
      duration_sec: typeof value.duration_sec === 'number' ? value.duration_sec : 0,
      completed: Boolean(value.completed),
      last_played_at: typeof value.last_played_at === 'string' ? value.last_played_at : '',
    }
  } catch {
    return null
  }
}

export function writePodcastProgress(record: PodcastProgressRecord) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(keyFor(record.episode_id), JSON.stringify(record))
  const ids = readIndex()
  if (!ids.includes(record.episode_id)) localStorage.setItem(indexKey, JSON.stringify([...ids, record.episode_id]))
}

export function listPodcastProgress(): PodcastProgressRecord[] {
  if (typeof localStorage === 'undefined') return []
  return readIndex().map(readPodcastProgress).filter((record): record is PodcastProgressRecord => Boolean(record))
}

function readIndex(): string[] {
  const raw = localStorage.getItem(indexKey)
  if (!raw) return []
  try {
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
