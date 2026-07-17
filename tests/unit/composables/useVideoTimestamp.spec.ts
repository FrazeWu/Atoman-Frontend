import { describe, expect, it } from 'vitest'
import {
  clampTimestamp,
  extractTimestampFromComment,
  formatTimestampLabel,
  serializeTimestampComment,
} from '@/composables/useVideoTimestamp'

describe('useVideoTimestamp', () => {
  it('formats mm:ss labels', () => {
    expect(formatTimestampLabel(92)).toBe('01:32')
  })

  it('formats hh:mm:ss labels', () => {
    expect(formatTimestampLabel(3671)).toBe('1:01:11')
  })

  it('clamps negative timestamp to zero', () => {
    expect(clampTimestamp(-5)).toBe(0)
  })

  it('clamps non-finite to zero', () => {
    expect(clampTimestamp(NaN)).toBe(0)
    expect(clampTimestamp(Infinity)).toBe(0)
  })

  it('floors float timestamp', () => {
    expect(clampTimestamp(92.9)).toBe(92)
  })

  it('serializes null timestamp_sec as null', () => {
    expect(serializeTimestampComment(null)).toEqual({ timestamp_sec: null })
    expect(serializeTimestampComment(undefined)).toEqual({ timestamp_sec: null })
  })

  it('serializes valid timestamp_sec', () => {
    expect(serializeTimestampComment(92)).toEqual({ timestamp_sec: 92 })
  })

  it('extracts mm:ss timestamp from comment text', () => {
    expect(extractTimestampFromComment('12:34 这里开始')).toBe(754)
  })

  it('extracts hh:mm:ss timestamp from comment text', () => {
    expect(extractTimestampFromComment('01:12:34 这里开始')).toBe(4354)
  })

  it('ignores unsupported timestamp formats', () => {
    expect(extractTimestampFromComment('1m23s 这里开始')).toBeNull()
    expect(extractTimestampFromComment('99 这里开始')).toBeNull()
    expect(extractTimestampFromComment('01:99:00 这里开始')).toBeNull()
  })
})
