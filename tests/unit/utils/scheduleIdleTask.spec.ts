import { afterEach, describe, expect, it, vi } from 'vitest'

import { scheduleIdleTask } from '@/utils/scheduleIdleTask'

describe('scheduleIdleTask', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('uses requestIdleCallback when available and can be cancelled', () => {
    const run = vi.fn()
    const cancel = vi.fn()
    const request = vi.fn(() => 7)
    vi.stubGlobal('requestIdleCallback', request)
    vi.stubGlobal('cancelIdleCallback', cancel)

    const cancelTask = scheduleIdleTask(run, 1200)

    expect(request).toHaveBeenCalledWith(expect.any(Function), { timeout: 1200 })
    cancelTask()
    expect(cancel).toHaveBeenCalledWith(7)
    expect(run).not.toHaveBeenCalled()
  })

  it('falls back to a timer when requestIdleCallback is unavailable', async () => {
    vi.useFakeTimers()
    const run = vi.fn()

    scheduleIdleTask(run)
    expect(run).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(run).toHaveBeenCalledOnce()
  })
})
