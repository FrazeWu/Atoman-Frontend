import type { RouteRecordRaw } from 'vue-router'
import { moduleFeatureRoutes } from '@/router/routes/modules'
import { moduleRooms } from '@/config/moduleRooms'

const additionalModules = ['books', 'podcast', 'video', 'forum', 'debate', 'timeline'] as const
const mobileModuleLayout = () => import('./MobileModuleLayout.vue')

export const mobileAdditionalRoutes: RouteRecordRaw[] = additionalModules.flatMap((module) => {
  const prefix = `/${moduleRooms[module].publicPathSegment}`
  return moduleFeatureRoutes[module].map((route): RouteRecordRaw => {
    if (route.path !== '/') return { ...route, path: `${prefix}${route.path}` }
    return {
      path: prefix,
      component: mobileModuleLayout,
      children: route.children?.map((child) => module === 'video' && child.path === 'favorites'
        ? { path: child.path, name: child.name, meta: child.meta, component: () => import('./MobileSavedView.vue'), props: { page: 'video-favorites' } }
        : child),
      meta: { mobileModule: module },
    }
  })
})
