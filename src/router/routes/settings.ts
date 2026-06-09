import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  { path: '/admin/site', redirect: '/setting/access' },
  {
    path: '/setting',
    component: () => import('@/views/setting/SettingLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, authLayout: true },
    children: [
      { path: '', redirect: '/setting/access' },
      { path: 'access', component: () => import('@/views/setting/SettingAccessView.vue') },
      { path: 'feed-fulltext', component: () => import('@/views/setting/SettingFeedFullText.vue') },
      { path: 'feed-sources', component: () => import('@/views/setting/SettingFeedSourcesView.vue') },
      { path: 'music-review', component: () => import('@/views/setting/SettingMusicReview.vue') },
      { path: 'roles', component: () => import('@/views/setting/SettingRolesView.vue'), meta: { requiresOwner: true } },
    ],
  },
]
