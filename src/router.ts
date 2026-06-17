import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { installRouteGuards } from '@/router/guards'
import { resolveSiteContext } from '@/router/siteContext'
import { userRoutes } from '@/router/routes/entities'
import { moduleRoutes } from '@/router/routes/modules'
import { unknownRoutes } from '@/router/routes/unknown'
import { portalRoutes } from '@/router/routes/portal'

function routesForCurrentSite(): RouteRecordRaw[] {
  const context = resolveSiteContext(window.location.hostname, window.location.search)

  if (context.type === 'portal') return portalRoutes
  if (context.type === 'module') return moduleRoutes[context.module]
  if (context.type === 'entity') return userRoutes
  return unknownRoutes
}

const router = createRouter({
  history: createWebHistory(),
  routes: routesForCurrentSite(),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

installRouteGuards(router)

export default router
