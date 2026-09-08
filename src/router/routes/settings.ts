import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  {
    path: '/site/setting',
    component: () => import('@/views/setting/SettingManagementLayout.vue'),
    meta: { requiresAuth: true, authLayout: true },
    children: [
      { path: '', component: () => import('@/views/setting/SettingAccessView.vue'), meta: { requiresAdmin: true } },
      // 保留版主的原有访问权限；管理员从统一设置页查看内嵌的社区管理区块。
      { path: 'community', component: () => import('@/views/setting/SettingCommunityView.vue'), meta: { requiresModerator: true } },
      { path: 'users', redirect: { path: '/site/setting', hash: '#users' }, meta: { requiresAdmin: true } },
      {
        path: 'subscriptions',
        redirect: { path: '/site/setting', hash: '#detail-feed' },
        meta: { requiresAdmin: true },
      },
      { path: 'announcements', redirect: { path: '/site/setting', hash: '#announcements' }, meta: { requiresAdmin: true } },
    ],
  },
]
