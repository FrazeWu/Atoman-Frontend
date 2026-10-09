// 只合并正在进行的请求，完成后仍可立即刷新；由调用方提供会话隔离 key。
export function createRequestCoalescer<T>() {
  const pending = new Map<string, Promise<T>>()
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key)
    if (existing) return existing
    const request = load().finally(() => {
      if (pending.get(key) === request) pending.delete(key)
    })
    pending.set(key, request)
    return request
  }
}
