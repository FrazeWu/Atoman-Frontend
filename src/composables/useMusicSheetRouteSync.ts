import { watch } from 'vue'
import type { Router } from 'vue-router'

import { useMusicDrawers } from '@/composables/useMusicDrawers'

const registeredRouters = new WeakSet<Router>()

export function useMusicSheetRouteSync(router: Router) {
  const drawers = useMusicDrawers()

  if (!registeredRouters.has(router)) {
    registeredRouters.add(router)

    watch(drawers.layers, async (layers, previousLayers) => {
      const top = layers.at(-1)
      const currentPath = router.currentRoute.value.path

      if (layers.length < previousLayers.length) {
        const removedRouteCount = previousLayers
          .slice(layers.length)
          .filter(layer => layer.route).length
        const currentRouteWasRemoved = previousLayers
          .slice(layers.length)
          .some(layer => layer.route === currentPath)

        if (currentRouteWasRemoved && removedRouteCount > 0) {
          router.go(-removedRouteCount)
          return
        }
      }

      if (top?.route && top.route !== currentPath) {
        await router.push(top.route)
      }
    })

    watch(() => router.currentRoute.value.path, (path) => {
      const matchingLayer = [...drawers.layers.value].reverse().find(layer => layer.route === path)
      if (matchingLayer) {
        drawers.popToLayer(matchingLayer.key)
        return
      }

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
