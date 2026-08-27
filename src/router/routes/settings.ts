import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  {
    path: '/site/setting',
    component: () => import('@/views/setting/SettingManagementLayout.vue'),
    meta: { requiresAuth: true, authLayout: true },
    children: [
      { path: '', component: () => import('@/views/setting/SettingAccessView.vue'), meta: { requiresAdmin: true } },
      { path: 'community', component: () => import('@/views/setting/SettingCommunityView.vue'), meta: { requiresModerator: true } },
      { path: 'users', component: () => import('@/views/setting/SettingUsersView.vue'), meta: { requiresAdmin: true } },
      { path: 'subscriptions', component: () => import('@/views/setting/SettingSubscriptionsView.vue'), meta: { requiresAdmin: true } },
      { path: 'announcements', component: () => import('@/views/setting/SettingAnnouncementsView.vue'), meta: { requiresAdmin: true } },
    ],
  },
]
