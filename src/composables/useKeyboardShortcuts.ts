import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

export interface KeyboardShortcut {
  key: string
  description: string
  handler: () => void
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

export function isKeyboardEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement
    ? target
    : typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  if (!element) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
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
    const shortcut = toValue(shortcuts).find((item) => matchesKeyboardShortcut(event, item))
    if (!shortcut) return
    event.preventDefault()
    shortcut.handler()
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

  return { shortcuts }
}
