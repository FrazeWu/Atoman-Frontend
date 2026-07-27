import type { Pinia } from 'pinia'

const callbacksByPinia = new WeakMap<Pinia, Set<() => void>>()

export const registerSessionReset = (pinia: Pinia, callback: () => void) => {
  const callbacks = callbacksByPinia.get(pinia) ?? new Set<() => void>()
  callbacks.add(callback)
  callbacksByPinia.set(pinia, callbacks)
  return () => callbacks.delete(callback)
}

export const clearSessionStores = (pinia: Pinia) => callbacksByPinia.get(pinia)?.forEach((callback) => callback())
