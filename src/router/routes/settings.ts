import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  {
    path: '/site/setting',
    component: () => import('@/views/setting/SettingManagementLayout.vue'),
    meta: { requiresAuth: true, authLayout: true },
    children: [
      { path: '', component: () => import('@/views/setting/SettingAccessView.vue'), meta: { requiresAdmin: true } },
    ],
  },
]
