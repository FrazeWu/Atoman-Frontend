import type { RouteRecordRaw } from 'vue-router'

export const unknownRoutes: RouteRecordRaw[] = [
  { path: '/:pathMatch(.*)*', component: () => import('@/views/UnknownSiteView.vue') },
]
