import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  {
    path: '/site/setting',
    component: () => import('@/views/setting/SettingAccessView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, authLayout: true },
  },
]
