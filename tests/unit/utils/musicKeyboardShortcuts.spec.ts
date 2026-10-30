import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  resolveMusicPlayerShortcut,
  isMusicKeyboardShortcutTargetBlocked,
} from '@/utils/musicKeyboardShortcuts'

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

  it('maps ArrowUp to volume-up and ArrowDown to volume-down', () => {
    expect(resolveMusicPlayerShortcut(keydown('ArrowUp'))).toBe('volume-up')
    expect(resolveMusicPlayerShortcut(keydown('ArrowDown'))).toBe('volume-down')
  })

  it('does not consume modified typing shortcuts', () => {
    expect(resolveMusicPlayerShortcut(keydown('m', { ctrlKey: true }))).toBeNull()
    expect(resolveMusicPlayerShortcut(keydown(' ', { altKey: true }))).toBeNull()
  })
})

describe('isMusicKeyboardShortcutTargetBlocked', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('blocks standard text inputs, textareas, and select elements', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    document.body.append(input, textarea, select)

    expect(isMusicKeyboardShortcutTargetBlocked(input)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(textarea)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(select)).toBe(true)
  })

  it('blocks rich text editors and contenteditable containers', () => {
    const editor = document.createElement('div')
    editor.className = 'p-editor'
    const paragraph = document.createElement('p')
    editor.appendChild(paragraph)

    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    const span = document.createElement('span')
    editable.appendChild(span)

    document.body.append(editor, editable)

    expect(isMusicKeyboardShortcutTargetBlocked(paragraph)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(span)).toBe(true)
  })

  it('blocks focus inside role="dialog" and role="alertdialog"', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const button = document.createElement('button')
    dialog.appendChild(button)

    const alertDialog = document.createElement('div')
    alertDialog.setAttribute('role', 'alertdialog')
    const alertBtn = document.createElement('button')
    alertDialog.appendChild(alertBtn)

    document.body.append(dialog, alertDialog)

    expect(isMusicKeyboardShortcutTargetBlocked(button)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(alertBtn)).toBe(true)
  })

  it('blocks focus inside .p-modal, .p-sheet, and .p-image-lightbox', () => {
    const modal = document.createElement('div')
    modal.className = 'p-modal'
    const card = document.createElement('div')
    modal.appendChild(card)

    const sheet = document.createElement('div')
    sheet.className = 'p-sheet'
    const sheetItem = document.createElement('div')
    sheet.appendChild(sheetItem)

    const lightbox = document.createElement('div')
    lightbox.className = 'p-image-lightbox'
    const closeBtn = document.createElement('button')
    lightbox.appendChild(closeBtn)

    document.body.append(modal, sheet, lightbox)

    expect(isMusicKeyboardShortcutTargetBlocked(card)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(sheetItem)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(closeBtn)).toBe(true)
  })

  it('blocks focus inside global search and notification popover', () => {
    const search = document.createElement('div')
    search.className = 'app-topbar-global-search'
    const searchResult = document.createElement('a')
    search.appendChild(searchResult)

    const popover = document.createElement('div')
    popover.className = 'notification-popover'
    const item = document.createElement('div')
    popover.appendChild(item)

    document.body.append(search, popover)

    expect(isMusicKeyboardShortcutTargetBlocked(searchResult)).toBe(true)
    expect(isMusicKeyboardShortcutTargetBlocked(item)).toBe(true)
  })

  it('blocks when a modal or sheet is open in DOM even if focus is outside player', () => {
    const modalBackdrop = document.createElement('div')
    modalBackdrop.className = 'p-modal-backdrop'
    const normalContainer = document.createElement('div')
    document.body.append(modalBackdrop, normalContainer)

    expect(isMusicKeyboardShortcutTargetBlocked(normalContainer)).toBe(true)
  })

  it('allows shortcuts on normal page elements when no modal or input is active', () => {
    const normalCard = document.createElement('div')
    normalCard.className = 'song-item'
    const normalButton = document.createElement('button')
    normalCard.appendChild(normalButton)
    document.body.appendChild(normalCard)

    expect(isMusicKeyboardShortcutTargetBlocked(normalButton)).toBe(false)
  })
})

