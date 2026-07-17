import { computed, shallowRef } from 'vue'

export interface BaseSheetLayer {
  key: string
  kind: string
  title: string
  returnFocusTo?: HTMLElement | null
}

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null

export function createSheetStack<T extends BaseSheetLayer>(options: { maxLayers?: number } = {}) {
  const layers = shallowRef<T[]>([])
  const top = computed<T | null>(() => layers.value.at(-1) ?? null)

  function push(layer: T) {
    if (top.value?.key === layer.key) return
    const next = {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? activeElement(),
    } as T
    layers.value = options.maxLayers
      ? [...layers.value, next].slice(-options.maxLayers)
      : [...layers.value, next]
  }

  function clear() {
    const focusTarget = layers.value[0]?.returnFocusTo
    layers.value = []
    if (focusTarget?.isConnected) {
      window.setTimeout(() => focusTarget.focus(), 0)
    }
  }

  return { layers, top, push, clear }
}
