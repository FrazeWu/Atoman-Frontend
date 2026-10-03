type IdleCallback = (deadline: IdleDeadline) => void

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export function scheduleIdleTask(task: () => void, timeout = 2000, minimumDelay = 0): () => void {
  const idleWindow = typeof window === 'undefined' ? undefined : window as IdleWindow
  let cancelled = false
  let timerHandle: ReturnType<typeof globalThis.setTimeout> | undefined
  let idleHandle: number | undefined

  const schedule = () => {
    if (cancelled) return

    if (idleWindow?.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => {
        if (!cancelled) task()
      }, { timeout })
      return
    }

    timerHandle = globalThis.setTimeout(() => {
      if (!cancelled) task()
    }, 0)
  }

  if (minimumDelay > 0) {
    timerHandle = globalThis.setTimeout(schedule, minimumDelay)
  } else {
    schedule()
  }

  return () => {
    cancelled = true
    if (timerHandle !== undefined) globalThis.clearTimeout(timerHandle)
    if (idleHandle !== undefined) idleWindow?.cancelIdleCallback?.(idleHandle)
  }
}
