import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { Window as HappyWindow } from 'happy-dom'

if (typeof window === 'undefined') {
  const dom = new HappyWindow()
  globalThis.window = dom as any
  globalThis.document = dom.document as any
  globalThis.EventTarget = dom.EventTarget as any
  globalThis.Event = dom.Event as any
}

import { useMobileKeyboard } from '@mobile/composables/useMobileKeyboard'

class MockVisualViewport extends EventTarget {
  width = 390
  height = 800
  offsetTop = 0
  offsetLeft = 0
  pageTop = 0
  pageLeft = 0
  scale = 1

  setHeight(h: number) {
    this.height = h
    this.dispatchEvent(new Event('resize'))
  }
}

describe('useMobileKeyboard', () => {
  let mockViewport: MockVisualViewport
  const originalVisualViewport = window.visualViewport
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    vi.useFakeTimers()
    mockViewport = new MockVisualViewport()
    Object.defineProperty(window, 'visualViewport', {
      value: mockViewport,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    })
    document.documentElement.style.removeProperty('--mobile-keyboard-height')
    document.documentElement.style.removeProperty('--mobile-viewport-height')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    Object.defineProperty(window, 'visualViewport', {
      value: originalVisualViewport,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    })
    document.documentElement.style.removeProperty('--mobile-keyboard-height')
    document.documentElement.style.removeProperty('--mobile-viewport-height')
  })

  it('initializes with default state when keyboard is closed', () => {
    const scope = effectScope()
    scope.run(() => {
      const { keyboardHeight, isKeyboardOpen, visualViewportHeight } = useMobileKeyboard()

      expect(keyboardHeight.value).toBe(0)
      expect(isKeyboardOpen.value).toBe(false)
      expect(visualViewportHeight.value).toBe(800)
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')
      expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('800px')
    })
    scope.stop()
  })

  it('updates keyboard state and CSS variables on visualViewport resize', () => {
    const scope = effectScope()
    scope.run(() => {
      const { keyboardHeight, isKeyboardOpen, visualViewportHeight } = useMobileKeyboard()

      // Simulate keyboard open (800 -> 500, keyboard is 300px)
      mockViewport.setHeight(500)

      expect(keyboardHeight.value).toBe(300)
      expect(isKeyboardOpen.value).toBe(true)
      expect(visualViewportHeight.value).toBe(500)
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('300px')
      expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('500px')

      // Simulate keyboard close (500 -> 800)
      mockViewport.setHeight(800)

      expect(keyboardHeight.value).toBe(0)
      expect(isKeyboardOpen.value).toBe(false)
      expect(visualViewportHeight.value).toBe(800)
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')
      expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('800px')
    })
    scope.stop()
  })

  it('ignores minor height changes (< 60px) to prevent false positives from address bar collapse', () => {
    const scope = effectScope()
    scope.run(() => {
      const { keyboardHeight, isKeyboardOpen } = useMobileKeyboard()

      // Small address bar collapse/expand (800 -> 760, diff 40px < 60px threshold)
      mockViewport.setHeight(760)

      expect(keyboardHeight.value).toBe(40)
      expect(isKeyboardOpen.value).toBe(false)
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('40px')
      expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('760px')
    })
    scope.stop()
  })

  it('supports injecting CSS variables onto a custom target element', () => {
    const customContainer = document.createElement('div')
    document.body.appendChild(customContainer)

    const scope = effectScope()
    scope.run(() => {
      const { keyboardHeight } = useMobileKeyboard({ target: customContainer })
      mockViewport.setHeight(520)

      expect(keyboardHeight.value).toBe(280)
      expect(customContainer.style.getPropertyValue('--mobile-keyboard-height')).toBe('280px')
      expect(customContainer.style.getPropertyValue('--mobile-viewport-height')).toBe('520px')
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('')
    })
    scope.stop()

    expect(customContainer.style.getPropertyValue('--mobile-keyboard-height')).toBe('')
    expect(customContainer.style.getPropertyValue('--mobile-viewport-height')).toBe('')
    customContainer.remove()
  })

  it('cleans up event listeners and removes CSS variables when scope is disposed', () => {
    const scope = effectScope()
    let keyboardHeightRef: any
    scope.run(() => {
      const { keyboardHeight } = useMobileKeyboard()
      keyboardHeightRef = keyboardHeight
      mockViewport.setHeight(500)
    })

    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('300px')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('500px')

    // Dispose scope
    scope.stop()

    // CSS variables should be removed
    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('')

    // Further resize events should not update the ref
    mockViewport.setHeight(400)
    expect(keyboardHeightRef.value).toBe(300)
  })

  it('handles environment without window.visualViewport gracefully', () => {
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const scope = effectScope()
    scope.run(() => {
      const { keyboardHeight, isKeyboardOpen, visualViewportHeight } = useMobileKeyboard()
      expect(keyboardHeight.value).toBe(0)
      expect(isKeyboardOpen.value).toBe(false)
      expect(visualViewportHeight.value).toBe(800)
      expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')
      expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('800px')
    })
    scope.stop()
  })

  describe('scrollFocusedElementIntoView', () => {
    it('scrolls provided element into view after delay', () => {
      const scope = effectScope()
      scope.run(() => {
        const { scrollFocusedElementIntoView } = useMobileKeyboard()
        const target = document.createElement('input')
        target.scrollIntoView = vi.fn()

        scrollFocusedElementIntoView(target)
        expect(target.scrollIntoView).not.toHaveBeenCalled()

        vi.advanceTimersByTime(120)
        expect(target.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center',
        })
      })
      scope.stop()
    })

    it('falls back to document.activeElement if no element is provided', () => {
      const scope = effectScope()
      scope.run(() => {
        const { scrollFocusedElementIntoView } = useMobileKeyboard()
        const input = document.createElement('textarea')
        document.body.appendChild(input)
        input.scrollIntoView = vi.fn()
        input.focus()

        scrollFocusedElementIntoView()
        expect(input.scrollIntoView).not.toHaveBeenCalled()

        vi.advanceTimersByTime(120)
        expect(input.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center',
        })

        input.remove()
      })
      scope.stop()
    })

    it('does not throw when no active element or target is available', () => {
      const scope = effectScope()
      scope.run(() => {
        const { scrollFocusedElementIntoView } = useMobileKeyboard()
        expect(() => {
          scrollFocusedElementIntoView(null)
          vi.advanceTimersByTime(120)
        }).not.toThrow()
      })
      scope.stop()
    })
  })
})
