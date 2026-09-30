import { createRouter, createWebHistory } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { installChunkLoadRecovery } from '@/router/chunkLoadRecovery'
import { mobileInitialRoutes } from './mobileInitialRoutes'

const initialRoutePaths = new Set(['/','/login','/register','/forgot-password'])
let deferredRoutesPromise: Promise<void> | null = null
let deferredRoutesReady = false

function ensureDeferredRoutes(router: ReturnType<typeof createRouter>) {
  deferredRoutesPromise ??= import('./mobileRoutes').then(({ mobileRoutes }) => {
    for (const route of mobileRoutes) {
      if (initialRoutePaths.has(route.path) || route.path === '/:pathMatch(.*)*') continue
      router.addRoute(route)
    }
    deferredRoutesReady = true
  })
  return deferredRoutesPromise
}

const router = createRouter({
  history: createWebHistory(),
  routes: mobileInitialRoutes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (initialRoutePaths.has(to.path) || deferredRoutesReady) return
  await ensureDeferredRoutes(router)
  return to.fullPath
})

installRouteGuards(router)
installChunkLoadRecovery(router)

export default router
