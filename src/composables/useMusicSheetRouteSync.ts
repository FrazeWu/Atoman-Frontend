import { watch } from 'vue'
import type { Router } from 'vue-router'

import { useMusicDrawers } from '@/composables/useMusicDrawers'

const registeredRouters = new WeakSet<Router>()
const musicEntityRoutePattern = /^\/music\/(?:artist|album|song|playlist)\/[^/]+$/

export function useMusicSheetRouteSync(router: Router) {
  const drawers = useMusicDrawers()

  if (!registeredRouters.has(router)) {
    registeredRouters.add(router)
    const pushedLayerKeys = new Set<string>()

    watch(drawers.layers, async (layers, previousLayers) => {
      const top = layers.at(-1)
      const currentPath = router.currentRoute.value.path

      if (layers.length < previousLayers.length) {
        const removedLayers = previousLayers
          .slice(layers.length)
        const removedRouteLayers = removedLayers.filter(layer => layer.route)
        const currentRouteWasRemoved = removedRouteLayers
          .some(layer => layer.route === currentPath)

        const canReturnThroughHistory = removedRouteLayers.every(layer => pushedLayerKeys.has(layer.key))
        for (const layer of removedRouteLayers) pushedLayerKeys.delete(layer.key)

        if (currentRouteWasRemoved && removedRouteLayers.length > 0) {
          if (!canReturnThroughHistory) {
            await router.replace('/music')
            return
          }
          router.go(-removedRouteLayers.length)
          return
        }
      }

      if (top?.route && top.route !== currentPath) {
        await router.push(top.route)
        if (!drawers.layers.value.some(layer => layer.key === top.key)) {
          await router.replace('/music')
          return
        }
        pushedLayerKeys.add(top.key)
      }
    })

    watch(() => router.currentRoute.value.path, (path) => {
      const matchingLayer = drawers.layers.value.find(layer => layer.route === path)
      if (matchingLayer) {
        drawers.popToLayer(matchingLayer.key)
        return
      }

      // Entity route views create the new layer after navigation. Keep the
      // existing path mounted until that watcher has a chance to push it.
      if (musicEntityRoutePattern.test(path)) return

      if (drawers.layers.value.some(layer => layer.route)) {
        drawers.closeAll()
      }
    })
  }

  function syncEntityRoute(key: string, open: () => void) {
    if (drawers.layers.value.some(layer => layer.key === key)) {
      drawers.popToLayer(key)
    } else {
      open()
    }
  }

  return { syncEntityRoute }
}
