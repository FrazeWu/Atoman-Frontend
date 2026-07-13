import { computed, shallowRef } from 'vue'

export interface BaseSheetLayer {
  key: string
  kind: string
  title: string
  route?: string
  returnFocusTo?: HTMLElement | null
}

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null

interface SheetStackOptions<T> {
  maxLayers?: number
  resolveOverflow?: (next: T, current: readonly T[]) => T[]
  overflowTransitionMs?: number
}

export function createSheetStack<T extends BaseSheetLayer>(options: SheetStackOptions<T> = {}) {
  const layers = shallowRef<T[]>([])
  const renderLayers = shallowRef<T[]>([])
  const top = computed<T | null>(() => layers.value.at(-1) ?? null)
  let renderTimer: number | null = null
  const withFocusTarget = (layer: T) => ({
    ...layer,
    returnFocusTo: layer.returnFocusTo ?? activeElement(),
  }) as T

  const cancelRenderTransition = () => {
    if (renderTimer === null) return
    window.clearTimeout(renderTimer)
    renderTimer = null
  }

  function push(layer: T) {
    if (renderTimer !== null) return
    if (top.value?.key === layer.key) return
    if (layers.value.some(item => item.key === layer.key)) {
      popTo(layer.key)
      return
    }
    const next = withFocusTarget(layer)

    if (options.maxLayers && layers.value.length >= options.maxLayers) {
      const resolved = options.resolveOverflow?.(next, layers.value) ?? [next]
      layers.value = resolved.slice(-options.maxLayers).map(withFocusTarget)
      const transitionMs = options.overflowTransitionMs ?? 0
      if (transitionMs > 0) {
        renderLayers.value = [
          ...renderLayers.value.filter(item => item.key !== next.key),
          next,
        ]
        renderTimer = window.setTimeout(() => {
          renderLayers.value = layers.value
          renderTimer = null
        }, transitionMs)
      } else {
        renderLayers.value = layers.value
      }
      return
    }

    layers.value = [...layers.value, next]
    renderLayers.value = layers.value
  }

  function replaceTop(layer: T) {
    cancelRenderTransition()
    layers.value = [...layers.value.slice(0, -1), {
      ...layer,
      returnFocusTo: layer.returnFocusTo ?? top.value?.returnFocusTo ?? activeElement(),
    }] as T[]
    renderLayers.value = layers.value
  }

  function restore(layer?: T) {
    if (layer?.returnFocusTo?.isConnected) {
      window.setTimeout(() => layer.returnFocusTo?.focus(), 0)
    }
  }

  function pop() {
    cancelRenderTransition()
    const removed = top.value ?? undefined
    layers.value = layers.value.slice(0, -1)
    renderLayers.value = layers.value
    restore(removed)
    return removed
  }

  function popTo(key: string) {
    cancelRenderTransition()
    const index = layers.value.findIndex(layer => layer.key === key)
    if (index < 0) return
    layers.value = layers.value.slice(0, index + 1)
    renderLayers.value = layers.value
  }

  function clear() {
    cancelRenderTransition()
    const first = layers.value[0]
    layers.value = []
    renderLayers.value = []
    restore(first)
  }

  const isTop = (key: string) => top.value?.key === key
  const isShifted = (key: string) => {
    const index = layers.value.findIndex(layer => layer.key === key)
    return index >= 0 && index < layers.value.length - 1
  }

  return { layers, renderLayers, top, push, replaceTop, pop, popTo, clear, isTop, isShifted }
}
