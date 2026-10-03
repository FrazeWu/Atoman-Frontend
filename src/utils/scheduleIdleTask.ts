type IdleCallback = (deadline: IdleDeadline) => void

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export function scheduleIdleTask(task: () => void, timeout = 2000): () => void {
  const idleWindow = typeof window === 'undefined' ? undefined : window as IdleWindow

  if (idleWindow?.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(() => task(), { timeout })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = globalThis.setTimeout(task, 0)
  return () => globalThis.clearTimeout(handle)
}
