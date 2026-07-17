import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialogFocus(
  open: Readonly<Ref<boolean>>,
  root: Ref<HTMLElement | null>,
  close: () => void,
) {
  let previousFocus: HTMLElement | null = null
  const focusableElements = () => root.value
    ? Array.from(root.value.querySelectorAll<HTMLElement>(focusableSelector))
    : []

  const restoreFocus = () => {
    const target = previousFocus
    previousFocus = null
    target?.focus()
  }

  const focusDialog = async () => {
    await nextTick()
    const first = focusableElements()[0]
    if (first) first.focus()
    else root.value?.focus()
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const elements = focusableElements()
    if (elements.length === 0) {
      event.preventDefault()
      root.value?.focus()
      return
    }

    const first = elements[0]
    const last = elements[elements.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !root.value?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(open, (isOpen, wasOpen) => {
    if (isOpen) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      void focusDialog()
    } else if (wasOpen) {
      restoreFocus()
    }
  }, { immediate: true })

  onBeforeUnmount(restoreFocus)
  return { handleKeydown }
}
