import { createRouter, createWebHistory } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { buildAppRoutes } from '@/router/buildAppRoutes'
import { installChunkLoadRecovery } from '@/router/chunkLoadRecovery'

const router = createRouter({
  history: createWebHistory(),
  routes: buildAppRoutes(),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

installRouteGuards(router)
installChunkLoadRecovery(router)

export default router
