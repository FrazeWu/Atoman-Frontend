import { createRouter, createWebHistory } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { buildAppRoutes } from '@/router/buildAppRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: buildAppRoutes(),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

installRouteGuards(router)

export default router
