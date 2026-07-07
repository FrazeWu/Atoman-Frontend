export const BIRTH_DATE_SLOT_POSITIONS = [0, 1, 2, 3, 5, 6, 8, 9] as const

export function getBirthDateDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatBirthDateInput(value: string) {
  const digits = getBirthDateDigits(value)
  const year = digits.slice(0, 4) || 'yyyy'
  const month = digits.slice(4, 6) || 'mm'
  const day = digits.slice(6, 8) || 'dd'
  return `${year}/${month}/${day}`
}

export function getBirthDateCursorIndex(digitCount: number) {
  const safeDigitCount = Math.max(0, Math.min(digitCount, 8))
  if (safeDigitCount >= 8) return 10
  return BIRTH_DATE_SLOT_POSITIONS[safeDigitCount]
}
