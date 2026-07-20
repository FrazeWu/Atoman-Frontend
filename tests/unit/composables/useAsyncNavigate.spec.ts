import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'

const clearStack = vi.fn()
const triggerExit = vi.fn()
const triggerEntry = vi.fn()
const resetTransition = vi.fn()
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/stores/sheet', () => ({
  useSheetStore: () => ({ clearStack }),
}))

vi.mock('@/stores/transition', () => ({
  useTransitionStore: () => ({
    triggerExit,
    triggerEntry,
    reset: resetTransition,
  }),
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
    routerPush.mockReset()
    routerPush.mockResolvedValue(undefined)
    clearStack.mockReset()
    triggerExit.mockReset()
    triggerEntry.mockReset()
    resetTransition.mockReset()
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

  it('falls back to router navigation when basic relay storage write fails', async () => {
    mockFailingStorage()
    const { navigateModuleWithShutter } = useAsyncNavigate()

    await navigateModuleWithShutter('/music')

    expect(clearStack).not.toHaveBeenCalled()
    expect(triggerExit).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith('/music')
    expect(assign).not.toHaveBeenCalled()
    expect(document.body.style.cursor).toBe('default')
  })

  it('starts router navigation without a fixed transition delay', async () => {
    const { navigateModuleWithShutter } = useAsyncNavigate()

    const navigation = navigateModuleWithShutter('/music')
    await Promise.resolve()

    expect(routerPush).toHaveBeenCalledWith('/music')
    await navigation
  })

  it('only completes the latest overlapping module navigation', async () => {
    let resolveFirst: (() => void) | undefined
    let resolveSecond: (() => void) | undefined
    routerPush
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve }))
    const { navigateModuleWithShutter } = useAsyncNavigate()

    const first = navigateModuleWithShutter('/music')
    const second = navigateModuleWithShutter('/forum')
    resolveSecond?.()
    await second
    resolveFirst?.()
    await first

    expect(routerPush.mock.calls).toEqual([['/music'], ['/forum']])
    expect(triggerEntry).toHaveBeenCalledTimes(1)
    expect(resetTransition).toHaveBeenCalledTimes(1)
  })
})
