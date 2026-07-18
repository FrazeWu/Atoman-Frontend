import type { RouteRecordRaw } from 'vue-router'
import { channelRoutes, userRoutes } from '@/router/routes/entities'
import { moduleRoutes } from '@/router/routes/modules'
import { portalRoutes } from '@/router/routes/portal'
import { settingRoutes } from '@/router/routes/settings'
import { studioRoutes } from '@/router/routes/studio'
import { moduleRooms } from '@/config/moduleRooms'

function scopedModuleRoutes(module: keyof typeof moduleRoutes): RouteRecordRaw[] {
  const publicPrefix = `/${moduleRooms[module].publicPathSegment}`

  return moduleRoutes[module]
    .filter((route) => !(
      route.path === '/login'
      || route.path === '/register'
      || route.path === '/:pathMatch(.*)*'
      || route.path === '/site/setting'
    ))
    .map((route) => {
      if (route.path === '/') {
        return {
          ...route,
          path: publicPrefix,
        }
      }

      return {
        ...route,
        path: `${publicPrefix}${route.path}`,
      }
    })
}

export function buildAppRoutes(): RouteRecordRaw[] {
  return [
    ...portalRoutes.filter((route) => route.path !== '/:pathMatch(.*)*'),
    ...settingRoutes,
    ...scopedModuleRoutes('feed'),
    ...scopedModuleRoutes('music'),
    ...scopedModuleRoutes('forum'),
    ...scopedModuleRoutes('debate'),
    ...scopedModuleRoutes('timeline'),
    ...scopedModuleRoutes('blog'),
    ...scopedModuleRoutes('podcast'),
    ...scopedModuleRoutes('video'),
	...studioRoutes,
    ...userRoutes,
    ...channelRoutes,
    { path: '/inbox', component: () => import('@/views/feed/InboxPage.vue'), meta: { requiresAuth: true } },
    { path: '/bookmarks', redirect: '/posts/bookmarks' },
    { path: '/__disabled__', component: () => import('@/views/system/ModuleUnavailableView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ]
}
