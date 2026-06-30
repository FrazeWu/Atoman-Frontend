import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'

const clearStack = vi.fn()
const triggerExit = vi.fn()

vi.mock('@/stores/sheet', () => ({
  useSheetStore: () => ({ clearStack }),
}))

vi.mock('@/stores/transition', () => ({
  useTransitionStore: () => ({ triggerExit }),
}))

function mockFailingStorage() {
  const failingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded')
    },
    removeItem: () => undefined,
    clear: () => undefined,
  } as unknown as Storage

  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(failingStorage)
}

describe('useAsyncNavigate', () => {
  const originalLocation = window.location
  const assign = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        assign,
      },
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    document.body.style.cursor = 'default'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    assign.mockReset()
    document.body.style.cursor = 'default'
  })

  it('does not start detail transition when relay storage write fails', async () => {
    mockFailingStorage()
    const { navigateWithShutter } = useAsyncNavigate()

    await navigateWithShutter(async () => ({ id: 1 }), '/feed/posts/1', 'post')

    expect(clearStack).not.toHaveBeenCalled()
    expect(triggerExit).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    expect(document.body.style.cursor).toBe('default')
  })

  it('does not start module transition when basic relay storage write fails', async () => {
    mockFailingStorage()
    const { navigateModuleWithShutter } = useAsyncNavigate()

    await navigateModuleWithShutter('/music')

    expect(clearStack).not.toHaveBeenCalled()
    expect(triggerExit).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    expect(document.body.style.cursor).toBe('default')
  })
})
