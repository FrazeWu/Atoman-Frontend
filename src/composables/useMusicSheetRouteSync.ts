import { getCurrentScope, onScopeDispose, watch } from 'vue'
import type { Router } from 'vue-router'

import { useMusicDrawers } from '@/composables/useMusicDrawers'

interface RouteSyncRegistration {
  stop: () => void
}

const registrations = new WeakMap<Router, RouteSyncRegistration>()
const musicEntityRoutePattern = /^\/music\/(?:artist|album|song|playlist)\/[^/]+$/

const retainedRoute = (layers: readonly { route?: string }[]) =>
  [...layers].reverse().find(layer => layer.route)?.route ?? '/music'

export function useMusicSheetRouteSync(router: Router) {
  const drawers = useMusicDrawers()

  if (!registrations.has(router)) {
    const pushedLayerKeys = new Set<string>()

    const stopLayersWatch = watch(drawers.layers, async (layers, previousLayers) => {
      const top = layers.at(-1)
      const currentPath = router.currentRoute.value.fullPath

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
            await router.replace(retainedRoute(layers))
            return
          }
          router.go(-removedRouteLayers.length)
          return
        }
      }

      if (top?.route && top.route !== currentPath) {
        await router.push(top.route)
        if (!drawers.layers.value.some(layer => layer.key === top.key)) {
          await router.replace(retainedRoute(drawers.layers.value))
          return
        }
        pushedLayerKeys.add(top.key)
      }
    })

    const stopRouteWatch = watch(() => router.currentRoute.value.fullPath, (fullPath) => {
      const path = router.currentRoute.value.path
      const matchingLayer = drawers.layers.value.find(layer => layer.route === fullPath)
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

    const registration: RouteSyncRegistration = {
      stop: () => {
        stopLayersWatch()
        stopRouteWatch()
      },
    }
    registrations.set(router, registration)

    if (getCurrentScope()) {
      onScopeDispose(() => {
        if (registrations.get(router) !== registration) return
        registration.stop()
        registrations.delete(router)
      })
    }
  }

  if (!musicEntityRoutePattern.test(router.currentRoute.value.path) && drawers.layers.value.some(layer => layer.route)) {
    drawers.closeAll()
  }

  function syncEntityRoute(key: string, open: () => void) {
    if (drawers.layers.value.some(layer => layer.key === key)) {
      drawers.popToLayer(key)
    } else if (drawers.layers.value.some(layer => layer.route === router.currentRoute.value.fullPath)) {
      // Current-sheet navigation updates the layer route while preserving its key.
      // The route view must reuse that layer instead of opening a duplicate one.
      return
    } else {
      open()
    }
  }

  return { syncEntityRoute }
}
