const callbacks = new Set<() => void>()
export const registerSessionReset = (callback: () => void) => { callbacks.add(callback); return () => callbacks.delete(callback) }
export const clearSessionStores = () => callbacks.forEach((callback) => callback())
