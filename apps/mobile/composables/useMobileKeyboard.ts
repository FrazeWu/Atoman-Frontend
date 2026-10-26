import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

export interface UseMobileKeyboardOptions {
  /**
   * Target element where CSS variables (`--mobile-keyboard-height`, `--mobile-viewport-height`) are injected.
   * Defaults to `document.documentElement`.
   */
  target?: HTMLElement | null
  /**
   * Minimum keyboard height in px to consider keyboard open (default: 60).
   * Filters minor shifts like browser address bar collapses.
   */
  threshold?: number
}

export interface UseMobileKeyboardReturn {
  keyboardHeight: Ref<number>
  isKeyboardOpen: Ref<boolean>
  visualViewportHeight: Ref<number>
  scrollFocusedElementIntoView: (el?: HTMLElement | null) => void
  cleanup: () => void
}

/**
 * Observes visual viewport changes and calculates mobile software keyboard status.
 * Injects `--mobile-keyboard-height` and `--mobile-viewport-height` CSS variables.
 */
export function useMobileKeyboard(options: UseMobileKeyboardOptions = {}): UseMobileKeyboardReturn {
  const threshold = options.threshold ?? 60

  const getTarget = (): HTMLElement | null => {
    if (options.target !== undefined) {
      return options.target
    }
    if (typeof document !== 'undefined') {
      return document.documentElement
    }
    return null
  }

  const keyboardHeight = ref(0)
  const isKeyboardOpen = ref(false)
  const visualViewportHeight = ref(
    typeof window !== 'undefined'
      ? (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight)
      : 0,
  )

  const update = () => {
    if (typeof window === 'undefined') return

    const vv = window.visualViewport
    const innerHeight = window.innerHeight

    if (vv) {
      const currentVvHeight = Math.round(vv.height)
      const computedKeyboard = Math.max(0, Math.round(innerHeight - vv.height))
      visualViewportHeight.value = currentVvHeight
      keyboardHeight.value = computedKeyboard
      isKeyboardOpen.value = computedKeyboard > threshold
    } else {
      visualViewportHeight.value = innerHeight
      keyboardHeight.value = 0
      isKeyboardOpen.value = false
    }

    const root = getTarget()
    if (root) {
      root.style.setProperty('--mobile-keyboard-height', `${keyboardHeight.value}px`)
      root.style.setProperty('--mobile-viewport-height', `${visualViewportHeight.value}px`)
    }
  }

  const cleanup = () => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', update)
      window.visualViewport.removeEventListener('scroll', update)
    }
    const root = getTarget()
    if (root) {
      root.style.removeProperty('--mobile-keyboard-height')
      root.style.removeProperty('--mobile-viewport-height')
    }
  }

  if (typeof window !== 'undefined') {
    update()
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update, { passive: true })
      window.visualViewport.addEventListener('scroll', update, { passive: true })
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(cleanup)
  }

  const scrollFocusedElementIntoView = (el?: HTMLElement | null) => {
    if (typeof window === 'undefined') return
    const target = el ?? (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null)
    if (!target || typeof target.scrollIntoView !== 'function') return

    setTimeout(() => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 100)
  }

  return {
    keyboardHeight,
    isKeyboardOpen,
    visualViewportHeight,
    scrollFocusedElementIntoView,
    cleanup,
  }
}
