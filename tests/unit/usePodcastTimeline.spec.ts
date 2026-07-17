import { describe, expect, it } from 'vitest'
import { parsePodcastTimeline, parsePodcastTimestamp } from '@/composables/usePodcastTimeline'

describe('usePodcastTimeline', () => {
  it('parses mm:ss and hh:mm:ss timestamps', () => {
    expect(parsePodcastTimestamp('12:05')).toBe(725)
    expect(parsePodcastTimestamp('01:02:30')).toBe(3750)
  })

  it('rejects invalid timestamps', () => {
    expect(parsePodcastTimestamp('12:99')).toBeNull()
    expect(parsePodcastTimestamp('01:99:00')).toBeNull()
  })

  it('extracts timestamp lines from shownotes', () => {
    const lines = parsePodcastTimeline('00:32 开场\n普通文本\n01:02:30 深入讨论')
    expect(lines[0]).toMatchObject({ timeLabel: '00:32', seconds: 32 })
    expect(lines[1]).toMatchObject({ raw: '普通文本' })
    expect(lines[2]).toMatchObject({ timeLabel: '01:02:30', seconds: 3750 })
  })
})
