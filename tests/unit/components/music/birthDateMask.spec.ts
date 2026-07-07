import { describe, expect, it } from 'vitest'
import {
  BIRTH_DATE_SLOT_POSITIONS,
  formatBirthDateInput,
  getBirthDateCursorIndex,
  getBirthDateDigits,
} from '@/components/music/birthDateMask'

describe('birthDateMask', () => {
  it('formats partial digits with yyyy/mm/dd placeholders', () => {
    expect(formatBirthDateInput('')).toBe('yyyy/mm/dd')
    expect(formatBirthDateInput('1987')).toBe('1987/mm/dd')
    expect(formatBirthDateInput('198701')).toBe('1987/01/dd')
    expect(formatBirthDateInput('19870102')).toBe('1987/01/02')
  })

  it('keeps only the first eight digits from arbitrary input', () => {
    expect(getBirthDateDigits('1987/mm/dd')).toBe('1987')
    expect(getBirthDateDigits('1987/01/02')).toBe('19870102')
    expect(getBirthDateDigits('198701021234')).toBe('19870102')
  })

  it('moves the cursor to the next editable segment', () => {
    expect(getBirthDateCursorIndex(0)).toBe(0)
    expect(getBirthDateCursorIndex(4)).toBe(BIRTH_DATE_SLOT_POSITIONS[4])
    expect(getBirthDateCursorIndex(6)).toBe(BIRTH_DATE_SLOT_POSITIONS[6])
    expect(getBirthDateCursorIndex(8)).toBe(10)
  })
})
