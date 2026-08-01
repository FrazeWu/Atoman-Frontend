import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  {
    path: '/site/setting',
    component: () => import('@/views/setting/SettingManagementLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, authLayout: true },
    children: [
      { path: '', component: () => import('@/views/setting/SettingAccessView.vue') },
      { path: 'community', component: () => import('@/views/setting/SettingCommunityView.vue') },
      { path: 'users', component: () => import('@/views/setting/SettingUsersView.vue') },
      { path: 'subscriptions', component: () => import('@/views/setting/SettingSubscriptionsView.vue') },
    ],
  },
]
