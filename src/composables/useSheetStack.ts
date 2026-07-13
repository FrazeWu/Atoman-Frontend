import { computed, shallowRef } from 'vue'

export interface BaseSheetLayer {
  key: string
  kind: string
  title: string
  route?: string
  returnFocusTo?: HTMLElement | null
}

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null

export function createSheetStack<T extends BaseSheetLayer>() {
  const layers = shallowRef<T[]>([])
  const top = computed<T | null>(() => layers.value.at(-1) ?? null)

  function push(layer: T) {
    if (top.value?.key === layer.key) return
    layers.value = [...layers.value, {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? activeElement(),
    }] as T[]
  }

  function replaceTop(layer: T) {
    layers.value = [...layers.value.slice(0, -1), {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? top.value?.returnFocusTo ?? activeElement(),
    }] as T[]
  }

  function restore(layer?: T) {
    if (layer?.returnFocusTo?.isConnected) {
      window.setTimeout(() => layer.returnFocusTo?.focus(), 0)
    }
  }

  function pop() {
    const removed = top.value ?? undefined
    layers.value = layers.value.slice(0, -1)
    restore(removed)
    return removed
  }

  function popTo(key: string) {
    const index = layers.value.findIndex(layer => layer.key === key)
    if (index < 0) return
    layers.value = layers.value.slice(0, index + 1)
  }

  function clear() {
    const first = layers.value[0]
    layers.value = []
    restore(first)
  }

  const isTop = (key: string) => top.value?.key === key
  const isShifted = (key: string) => {
    const index = layers.value.findIndex(layer => layer.key === key)
    return index >= 0 && index < layers.value.length - 1
  }

  return { layers, top, push, replaceTop, pop, popTo, clear, isTop, isShifted }
}
