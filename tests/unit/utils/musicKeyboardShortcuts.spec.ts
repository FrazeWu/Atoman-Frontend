import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  resolveMusicPlayerShortcut,
  isInputOrIMEActive,
  isPlayerActiveContext,
  isInteractiveWidgetActive,
  isMusicKeyboardShortcutTargetBlocked,
} from '@/utils/musicKeyboardShortcuts'

function keydown(key: string, options: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
}

describe('musicKeyboardShortcuts Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('1. Native Browser Scrolling Protection (原生滚动与业务按键保护)', () => {
    it('does NOT intercept Space when browsing a regular page with body focus', () => {
      const event = keydown(' ', { code: 'Space' })
      const result = resolveMusicPlayerShortcut(event, { showLyrics: false })
      expect(result).toBeNull()
      expect(event.defaultPrevented).toBe(false)
    })

    it('does NOT intercept ArrowUp / ArrowDown on regular pages to allow smooth scrolling', () => {
      expect(resolveMusicPlayerShortcut(keydown('ArrowUp'), { showLyrics: false })).toBeNull()
      expect(resolveMusicPlayerShortcut(keydown('ArrowDown'), { showLyrics: false })).toBeNull()
    })

    it('does NOT intercept ArrowLeft / ArrowRight on regular pages', () => {
      expect(resolveMusicPlayerShortcut(keydown('ArrowLeft'), { showLyrics: false })).toBeNull()
      expect(resolveMusicPlayerShortcut(keydown('ArrowRight'), { showLyrics: false })).toBeNull()
    })

    it('does NOT intercept single "m" key on regular pages so Feed "mark read" works', () => {
      expect(resolveMusicPlayerShortcut(keydown('m'), { showLyrics: false })).toBeNull()
    })

    it('does NOT intercept Alt+Left / Alt+Right on regular pages to protect browser Back/Forward', () => {
      expect(resolveMusicPlayerShortcut(keydown('ArrowLeft', { altKey: true }), { showLyrics: false })).toBeNull()
      expect(resolveMusicPlayerShortcut(keydown('ArrowRight', { altKey: true }), { showLyrics: false })).toBeNull()
    })

    it('leaves L to the global content-focus shortcut', () => {
      expect(resolveMusicPlayerShortcut(keydown('l'), { showLyrics: true })).toBeNull()
    })
  })

  describe('2. Global Blind Control (全局盲操修饰键 Alt + Shift)', () => {
    it('triggers play/pause with Alt + Shift + Space anywhere', () => {
      const event = keydown(' ', { code: 'Space', altKey: true, shiftKey: true })
      expect(resolveMusicPlayerShortcut(event, { showLyrics: false })).toBe('toggle-play')
    })

    it('triggers next/previous track with Alt + Shift + Arrows', () => {
      expect(resolveMusicPlayerShortcut(keydown('ArrowRight', { altKey: true, shiftKey: true }))).toBe('next')
      expect(resolveMusicPlayerShortcut(keydown('ArrowLeft', { altKey: true, shiftKey: true }))).toBe('previous')
    })

    it('triggers volume adjustment with Alt + Shift + Up/Down', () => {
      expect(resolveMusicPlayerShortcut(keydown('ArrowUp', { altKey: true, shiftKey: true }))).toBe('volume-up')
      expect(resolveMusicPlayerShortcut(keydown('ArrowDown', { altKey: true, shiftKey: true }))).toBe('volume-down')
    })

    it('triggers mute with Alt + Shift + M', () => {
      expect(resolveMusicPlayerShortcut(keydown('m', { altKey: true, shiftKey: true }))).toBe('mute')
    })

    it('triggers lyrics with Shift + F globally', () => {
      expect(resolveMusicPlayerShortcut(keydown('F', { shiftKey: true }))).toBe('lyrics')
      expect(resolveMusicPlayerShortcut(keydown('f'))).toBeNull()
    })

    it('does not consume modified typing shortcuts like Ctrl or Meta', () => {
      expect(resolveMusicPlayerShortcut(keydown('m', { ctrlKey: true }))).toBeNull()
      expect(resolveMusicPlayerShortcut(keydown(' ', { metaKey: true }))).toBeNull()
    })
  })

  describe('3. Player-Active Context (播放器与沉浸歌词域单键操作)', () => {
    it('allows single Space to toggle play when focus is inside .player', () => {
      const playerEl = document.createElement('div')
      playerEl.className = 'player'
      const focusTarget = document.createElement('div')
      playerEl.appendChild(focusTarget)
      document.body.appendChild(playerEl)

      const event = keydown(' ', { code: 'Space' })
      const result = resolveMusicPlayerShortcut(event, {
        activeElement: focusTarget,
        showLyrics: false,
      })
      expect(result).toBe('toggle-play')
    })

    it('allows single Space and Arrows when lyrics panel is active', () => {
      expect(resolveMusicPlayerShortcut(keydown(' '), { showLyrics: true })).toBe('toggle-play')
      expect(resolveMusicPlayerShortcut(keydown('ArrowLeft'), { showLyrics: true })).toBe('skip-back')
      expect(resolveMusicPlayerShortcut(keydown('ArrowRight'), { showLyrics: true })).toBe('skip-forward')
      expect(resolveMusicPlayerShortcut(keydown('ArrowUp'), { showLyrics: true })).toBe('volume-up')
      expect(resolveMusicPlayerShortcut(keydown('ArrowDown'), { showLyrics: true })).toBe('volume-down')
      expect(resolveMusicPlayerShortcut(keydown('m'), { showLyrics: true })).toBe('mute')
    })

    it('does NOT steal Space when focus is on a non-player button', () => {
      const button = document.createElement('button')
      button.className = 'like-button'
      document.body.appendChild(button)

      const event = keydown(' ', { code: 'Space' })
      const result = resolveMusicPlayerShortcut(event, {
        activeElement: button,
        showLyrics: true,
      })
      expect(result).toBeNull()
    })

    it('recognizes player queue focus as active context', () => {
      const queueEl = document.createElement('div')
      queueEl.className = 'audio-player-queue'
      const queueItem = document.createElement('div')
      queueEl.appendChild(queueItem)
      document.body.appendChild(queueEl)

      expect(isPlayerActiveContext({ showQueue: true }, queueItem)).toBe(true)
    })
  })

  describe('4. Input, IME, and Modal Guarding (输入框与中文输入法防护)', () => {
    it('blocks all shortcuts during IME composition (event.isComposing / keyCode 229)', () => {
      const composingEvent = keydown(' ', { isComposing: true })
      expect(resolveMusicPlayerShortcut(composingEvent, { showLyrics: true })).toBeNull()

      const pinyinEvent = new KeyboardEvent('keydown', { keyCode: 229 } as any)
      expect(resolveMusicPlayerShortcut(pinyinEvent, { showLyrics: true })).toBeNull()
    })

    it('blocks shortcuts inside input, textarea, and rich editors', () => {
      const input = document.createElement('input')
      const editor = document.createElement('div')
      editor.className = 'p-editor'
      const p = document.createElement('p')
      editor.appendChild(p)
      document.body.append(input, editor)

      expect(
        resolveMusicPlayerShortcut(keydown(' ', { altKey: true, shiftKey: true }), {
          activeElement: input,
        })
      ).toBeNull()
      expect(
        resolveMusicPlayerShortcut(keydown(' ', { altKey: true, shiftKey: true }), {
          activeElement: p,
        })
      ).toBeNull()
    })

    it('blocks shortcuts when modal dialog is open and focus is outside player', () => {
      const modal = document.createElement('div')
      modal.className = 'p-modal'
      modal.setAttribute('aria-modal', 'true')
      const normalDiv = document.createElement('div')
      document.body.append(modal, normalDiv)

      expect(
        resolveMusicPlayerShortcut(keydown(' '), { activeElement: normalDiv, showLyrics: false })
      ).toBeNull()
    })

    it('isMusicKeyboardShortcutTargetBlocked returns true for inputs and modals', () => {
      const input = document.createElement('input')
      expect(isMusicKeyboardShortcutTargetBlocked(input)).toBe(true)

      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      const btn = document.createElement('button')
      dialog.appendChild(btn)
      document.body.appendChild(dialog)
      expect(isMusicKeyboardShortcutTargetBlocked(btn)).toBe(true)
    })
  })
})
