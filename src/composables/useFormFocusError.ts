import { nextTick, type Ref, unref } from 'vue'

export interface FocusErrorOptions {
  smooth?: boolean
  focus?: boolean
}

export function focusFirstInvalidField(
  container?: HTMLElement | Ref<HTMLElement | null> | null,
  options: FocusErrorOptions = {},
): boolean {
  const root = unref(container) ?? (typeof document !== 'undefined' ? document : null)
  if (!root) return false

  const invalidElement = root.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])')
  if (!invalidElement) return false

  if (options.smooth !== false && typeof invalidElement.scrollIntoView === 'function') {
    invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (options.focus !== false && typeof invalidElement.focus === 'function') {
    invalidElement.focus({ preventScroll: true })
  }

  return true
}

export function useFormFocusError() {
  const focusError = async (
    container?: HTMLElement | Ref<HTMLElement | null> | null,
    options?: FocusErrorOptions,
  ): Promise<boolean> => {
    await nextTick()
    return focusFirstInvalidField(container, options)
  }

  return {
    focusFirstInvalidField,
    focusError,
  }
}
