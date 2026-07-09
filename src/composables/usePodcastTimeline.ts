export interface PodcastTimelineLine {
  raw: string
  timeLabel?: string
  seconds?: number
}

export function parsePodcastTimestamp(label: string): number | null {
  const parts = label.split(':').map(part => Number(part))
  if (
    parts.length < 2
    || parts.length > 3
    || parts.some(part => !Number.isInteger(part) || part < 0)
  ) {
    return null
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    if (seconds >= 60) return null
    return minutes * 60 + seconds
  }

  const [hours, minutes, seconds] = parts
  if (minutes >= 60 || seconds >= 60) return null
  return hours * 3600 + minutes * 60 + seconds
}

export function parsePodcastTimeline(text: string): PodcastTimelineLine[] {
  return text.split(/\r?\n/).map((raw) => {
    const match = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)
    if (!match) return { raw }

    const seconds = parsePodcastTimestamp(match[1])
    if (seconds === null) return { raw }

    return { raw, timeLabel: match[1], seconds }
  })
}
