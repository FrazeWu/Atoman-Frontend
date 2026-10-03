import { createRouter, createWebHistory } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { buildInitialRoutes } from '@/router/buildInitialRoutes'
import { installChunkLoadRecovery } from '@/router/chunkLoadRecovery'

const router = createRouter({
  history: createWebHistory(),
  routes: buildInitialRoutes(),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

installRouteGuards(router)
installChunkLoadRecovery(router)

export default router
