import { describe, expect, it } from 'vitest'
import { resolveMusicPlayerShortcut } from '@/utils/musicKeyboardShortcuts'

function keydown(key: string, options: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent('keydown', { key, bubbles: true, ...options })
}

describe('resolveMusicPlayerShortcut', () => {
  it('leaves L to the global content-focus shortcut', () => {
    expect(resolveMusicPlayerShortcut(keydown('l'))).toBeNull()
  })

  it('opens lyrics only with Shift+F', () => {
    expect(resolveMusicPlayerShortcut(keydown('F', { shiftKey: true }))).toBe('lyrics')
    expect(resolveMusicPlayerShortcut(keydown('f'))).toBeNull()
  })

  it('does not consume modified typing shortcuts', () => {
    expect(resolveMusicPlayerShortcut(keydown('m', { ctrlKey: true }))).toBeNull()
    expect(resolveMusicPlayerShortcut(keydown(' ', { altKey: true }))).toBeNull()
  })
})
