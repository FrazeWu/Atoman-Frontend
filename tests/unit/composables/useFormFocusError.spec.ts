if (typeof document === 'undefined') {
  const { Window } = await import('happy-dom')
  const win = new Window()
  ;(globalThis as any).window = win
  ;(globalThis as any).document = win.document
  ;(globalThis as any).HTMLElement = win.HTMLElement
  ;(globalThis as any).HTMLInputElement = win.HTMLInputElement
}

import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { focusFirstInvalidField, useFormFocusError } from '@/composables/useFormFocusError'

describe('useFormFocusError & focusFirstInvalidField', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    document.body.replaceChildren()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  describe('focusFirstInvalidField', () => {
    it('finds and focuses the first invalid element among multiple inputs', () => {
      const input1 = document.createElement('input')
      input1.id = 'input-1'

      const input2 = document.createElement('input')
      input2.id = 'input-2'
      input2.setAttribute('aria-invalid', 'true')
      input2.scrollIntoView = vi.fn()
      input2.focus = vi.fn()

      const input3 = document.createElement('input')
      input3.id = 'input-3'
      input3.setAttribute('aria-invalid', 'true')
      input3.scrollIntoView = vi.fn()
      input3.focus = vi.fn()

      container.appendChild(input1)
      container.appendChild(input2)
      container.appendChild(input3)

      const result = focusFirstInvalidField(container)

      expect(result).toBe(true)
      expect(input2.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
      expect(input2.focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(input3.scrollIntoView).not.toHaveBeenCalled()
      expect(input3.focus).not.toHaveBeenCalled()
    })

    it('calls scrollIntoView with { behavior: "smooth", block: "center" }', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'true')
      const scrollIntoViewMock = vi.fn()
      input.scrollIntoView = scrollIntoViewMock

      container.appendChild(input)

      const result = focusFirstInvalidField(container)
      expect(result).toBe(true)
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    })

    it('ignores disabled invalid elements and finds the next enabled invalid element', () => {
      const disabledInvalidInput = document.createElement('input')
      disabledInvalidInput.setAttribute('aria-invalid', 'true')
      disabledInvalidInput.setAttribute('disabled', '')
      disabledInvalidInput.focus = vi.fn()
      disabledInvalidInput.scrollIntoView = vi.fn()

      const enabledInvalidInput = document.createElement('input')
      enabledInvalidInput.setAttribute('aria-invalid', 'true')
      enabledInvalidInput.focus = vi.fn()
      enabledInvalidInput.scrollIntoView = vi.fn()

      container.appendChild(disabledInvalidInput)
      container.appendChild(enabledInvalidInput)

      const result = focusFirstInvalidField(container)
      expect(result).toBe(true)
      expect(disabledInvalidInput.focus).not.toHaveBeenCalled()
      expect(enabledInvalidInput.focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('returns false when all invalid elements are disabled', () => {
      const disabledInvalidInput = document.createElement('input')
      disabledInvalidInput.setAttribute('aria-invalid', 'true')
      disabledInvalidInput.setAttribute('disabled', 'true')

      container.appendChild(disabledInvalidInput)

      const result = focusFirstInvalidField(container)
      expect(result).toBe(false)
    })

    it('returns false without throwing when no elements have aria-invalid="true"', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'false')
      container.appendChild(input)

      expect(() => {
        const result = focusFirstInvalidField(container)
        expect(result).toBe(false)
      }).not.toThrow()
    })

    it('accepts container as a Vue Ref', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'true')
      input.focus = vi.fn()
      container.appendChild(input)

      const containerRef = ref<HTMLElement | null>(container)
      const result = focusFirstInvalidField(containerRef)

      expect(result).toBe(true)
      expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('defaults to document when container is not provided', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'true')
      input.focus = vi.fn()
      container.appendChild(input)

      const result = focusFirstInvalidField()
      expect(result).toBe(true)
      expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('respects options.smooth === false to skip scrollIntoView', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'true')
      input.scrollIntoView = vi.fn()
      input.focus = vi.fn()
      container.appendChild(input)

      const result = focusFirstInvalidField(container, { smooth: false })
      expect(result).toBe(true)
      expect(input.scrollIntoView).not.toHaveBeenCalled()
      expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('respects options.focus === false to skip focus', () => {
      const input = document.createElement('input')
      input.setAttribute('aria-invalid', 'true')
      input.scrollIntoView = vi.fn()
      input.focus = vi.fn()
      container.appendChild(input)

      const result = focusFirstInvalidField(container, { focus: false })
      expect(result).toBe(true)
      expect(input.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
      expect(input.focus).not.toHaveBeenCalled()
    })

    it('handles elements without scrollIntoView or focus gracefully', () => {
      const el = document.createElement('div')
      el.setAttribute('aria-invalid', 'true')
      // remove methods to test safety checks
      ;(el as any).scrollIntoView = undefined
      ;(el as any).focus = undefined
      container.appendChild(el)

      expect(() => {
        const result = focusFirstInvalidField(container)
        expect(result).toBe(true)
      }).not.toThrow()
    })
  })

  describe('useFormFocusError composable', () => {
    it('returns focusFirstInvalidField and focusError functions', () => {
      const composable = useFormFocusError()
      expect(typeof composable.focusFirstInvalidField).toBe('function')
      expect(typeof composable.focusError).toBe('function')
    })

    it('focusError waits for nextTick() before searching and focusing invalid element', async () => {
      const { focusError } = useFormFocusError()
      const input = document.createElement('input')
      input.focus = vi.fn()
      input.scrollIntoView = vi.fn()
      container.appendChild(input)

      let tickExecuted = false
      const focusPromise = focusError(container).then((res) => {
        expect(tickExecuted).toBe(true)
        return res
      })

      // Modify DOM asynchronously before nextTick resolves
      input.setAttribute('aria-invalid', 'true')
      tickExecuted = true

      const result = await focusPromise
      expect(result).toBe(true)
      expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(input.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    })

    it('focusError returns false if no invalid element is present after nextTick()', async () => {
      const { focusError } = useFormFocusError()
      const result = await focusError(container)
      expect(result).toBe(false)
    })
  })
})
