import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'
import { hasActiveDialog } from './useDialogFocus'

export interface KeyboardShortcut {
  key: string
  description: string
  handler: () => void
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  allowInDialog?: boolean
}

export function isModalOverlayActive(): boolean {
  return hasActiveDialog()
}

export function isKeyboardEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement
    ? target
    : typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  if (!element) return false
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable) {
    return true
  }
  return Boolean(element.closest?.('.p-editor, .dm-composer, .cm-editor, [contenteditable="true"]'))
}

export function matchesKeyboardShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  return event.key.toLowerCase() === shortcut.key.toLowerCase()
    && event.ctrlKey === Boolean(shortcut.ctrl)
    && event.metaKey === Boolean(shortcut.meta)
    && event.shiftKey === Boolean(shortcut.shift)
    && event.altKey === Boolean(shortcut.alt)
}

export function useKeyboardShortcuts(
  shortcuts: MaybeRefOrGetter<KeyboardShortcut[]>,
) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isKeyboardEditableTarget(event.target)) return

    const inDialog = isModalOverlayActive()
    const shortcut = toValue(shortcuts).find((item) => {
      if (inDialog && !item.allowInDialog) return false
      return matchesKeyboardShortcut(event, item)
    })

    if (!shortcut) return
    event.preventDefault()
    shortcut.handler()
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

  return { shortcuts }
}
