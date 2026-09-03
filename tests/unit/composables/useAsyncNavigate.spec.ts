import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'

const clearStack = vi.fn()
const triggerExit = vi.fn()
const triggerEntry = vi.fn()
const startModuleNavigation = vi.fn()
const finishModuleNavigation = vi.fn()
const resetTransition = vi.fn()
const routerPush = vi.fn()
const checkRelay = vi.fn()

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
    startModuleNavigation,
    finishModuleNavigation,
    reset: resetTransition,
  }),
}))

vi.mock('@/composables/useTransitionRelay', () => ({
  useTransitionRelay: () => ({ checkRelay }),
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
    startModuleNavigation.mockReset()
    finishModuleNavigation.mockReset()
    resetTransition.mockReset()
    checkRelay.mockReset()
    triggerExit.mockResolvedValue(undefined)
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

  it('starts module navigation without hiding the current page', async () => {
    const { navigateModuleWithShutter } = useAsyncNavigate()

    const navigation = navigateModuleWithShutter('/music')
    await Promise.resolve()

    expect(clearStack).toHaveBeenCalledOnce()
    expect(triggerExit).not.toHaveBeenCalled()
    expect(startModuleNavigation).toHaveBeenCalledOnce()
    expect(routerPush).toHaveBeenCalledWith('/music')
    await navigation
  })

  it('starts router navigation without a fixed transition delay', async () => {
    const { navigateModuleWithShutter } = useAsyncNavigate()

    const navigation = navigateModuleWithShutter('/music')
    await Promise.resolve()

    expect(routerPush).toHaveBeenCalledWith('/music')
    await navigation
  })

  it('resets module transition when navigation is aborted', async () => {
    routerPush.mockResolvedValueOnce({ type: 4 })
    const { navigateModuleWithShutter } = useAsyncNavigate()

    await navigateModuleWithShutter('/music')

    expect(resetTransition).toHaveBeenCalledOnce()
  })

  it('checks the transition relay after detail navigation', async () => {
    const { navigateWithShutter } = useAsyncNavigate()

    const navigation = navigateWithShutter(async () => ({ id: 1 }), '/posts/1', 'post')
    await vi.advanceTimersByTimeAsync(500)
    await navigation

    expect(routerPush).toHaveBeenCalledWith('/posts/1')
    expect(checkRelay).toHaveBeenCalledTimes(1)
  })

  it('waits for detail exit completion instead of a fixed delay', async () => {
    let resolveExit: (() => void) | undefined
    triggerExit.mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveExit = resolve
    }))
    const { navigateWithShutter } = useAsyncNavigate()

    const navigation = navigateWithShutter(async () => ({ id: 1 }), '/posts/1', 'post')
    await Promise.resolve()
    await Promise.resolve()

    expect(triggerExit).toHaveBeenCalledOnce()
    expect(routerPush).not.toHaveBeenCalled()

    resolveExit?.()
    await navigation

    expect(routerPush).toHaveBeenCalledWith('/posts/1')
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
    expect(startModuleNavigation).toHaveBeenCalledTimes(2)
    expect(triggerExit).not.toHaveBeenCalled()
    expect(triggerEntry).not.toHaveBeenCalled()
    expect(resetTransition).not.toHaveBeenCalled()
  })
})
