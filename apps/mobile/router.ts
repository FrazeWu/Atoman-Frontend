import { createRouter, createWebHistory } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { installChunkLoadRecovery } from '@/router/chunkLoadRecovery'
import { mobileRoutes } from './mobileRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: mobileRoutes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

installRouteGuards(router)
installChunkLoadRecovery(router)

export default router
