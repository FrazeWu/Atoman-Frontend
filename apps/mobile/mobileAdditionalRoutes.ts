import type { RouteRecordRaw } from 'vue-router'
import { moduleFeatureRoutes } from '@/router/routes/modules'
import { moduleRooms } from '@/config/moduleRooms'
import { withUnifiedSearch } from '@/router/unifiedSearchRoutes'

const additionalModules = ['books', 'podcast', 'video', 'forum', 'debate', 'timeline'] as const
const mobileModuleLayout = () => import('./MobileModuleLayout.vue')

export const mobileAdditionalRoutes: RouteRecordRaw[] = additionalModules.flatMap((module) => {
  const prefix = `/${moduleRooms[module].publicPathSegment}`
  return withUnifiedSearch(moduleFeatureRoutes[module], module).map((route): RouteRecordRaw => {
    if (route.path !== '/') return { ...route, path: `${prefix}${route.path}` }
    const children = route.children
      ?.filter((child) => {
        // Books and Debate have their root mobile home views registered directly in mobileRoutes
        if ((module === 'books' || module === 'debate') && child.path === '') return false
        return true
      })
      .map((child) => {
        if (module === 'video' && child.path === 'favorites') {
          return { path: child.path, name: child.name, meta: child.meta, component: () => import('./MobileSavedView.vue'), props: { page: 'video-favorites' } }
        }
        return child
      })

    return {
      path: prefix,
      component: mobileModuleLayout,
      children,
      meta: { mobileModule: module },
    }
  })
})
