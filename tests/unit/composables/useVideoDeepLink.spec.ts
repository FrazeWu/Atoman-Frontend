import { describe, expect, it } from 'vitest'
import { buildVideoTimeLink, parseVideoTimeParam } from '@/composables/useVideoDeepLink'

describe('useVideoDeepLink', () => {
  it('parses seconds and minute-second values', () => {
    expect(parseVideoTimeParam('92')).toBe(92)
    expect(parseVideoTimeParam('1m32s')).toBe(92)
    expect(parseVideoTimeParam('-4')).toBe(0)
    expect(parseVideoTimeParam('bad')).toBeNull()
  })

  it('builds a current-time URL without dropping existing site query', () => {
    const url = buildVideoTimeLink('http://localhost:5173/watch/abc?site=video', 92)
    expect(url).toBe('http://localhost:5173/watch/abc?site=video&t=92')
  })
})
