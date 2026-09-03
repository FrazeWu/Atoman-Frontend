import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTransitionStore } from '../../../src/stores/transition'

describe('transition store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the exit state recoverable when the transition event does not arrive', () => {
    const transition = useTransitionStore()

    transition.triggerExit()
    expect(transition.isExiting).toBe(true)

    vi.advanceTimersByTime(1000)
    expect(transition.isExiting).toBe(false)
  })

  it('resolves exit navigation from the transition completion signal', async () => {
    const transition = useTransitionStore()
    let settled = false
    const exit = transition.triggerExit()
    void exit.then(() => { settled = true })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(transition.isExiting).toBe(true)

    transition.completeExit()
    await exit

    expect(settled).toBe(true)
    expect(transition.isExiting).toBe(true)
    transition.reset()
    expect(transition.isExiting).toBe(false)
  })

  it('replaces an exit state with an entry state', () => {
    const transition = useTransitionStore()

    transition.triggerExit()
    transition.triggerEntry()

    expect(transition.isExiting).toBe(false)
    expect(transition.isEntering).toBe(true)

    vi.advanceTimersByTime(800)
    expect(transition.isEntering).toBe(false)
  })

  it('cancels pending transition timers when reset', () => {
    const transition = useTransitionStore()

    transition.triggerExit()
    transition.reset()
    vi.advanceTimersByTime(1000)

    expect(transition.isExiting).toBe(false)
    expect(transition.isEntering).toBe(false)
    expect(transition.isModuleNavigation).toBe(false)
  })

  it('keeps module navigation state separate from the legacy shutter state', () => {
    const transition = useTransitionStore()

    transition.startModuleNavigation()

    expect(transition.isModuleNavigation).toBe(true)
    expect(transition.isExiting).toBe(false)
    expect(transition.isEntering).toBe(false)

    transition.finishModuleNavigation()

    expect(transition.isModuleNavigation).toBe(false)
  })
})
