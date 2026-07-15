import type { RouteRecordRaw } from 'vue-router'

export const settingRoutes: RouteRecordRaw[] = [
  { path: '/admin/site', redirect: '/setting/access' },
  {
    path: '/setting',
    component: () => import('@/views/setting/SettingLayout.vue'),
    meta: { requiresAuth: true, authLayout: true },
    children: [
      { path: '', redirect: '/setting/access' },
      { path: 'access', component: () => import('@/views/setting/SettingAccessView.vue'), meta: { requiresAdmin: true } },
      { path: 'feed-fulltext', redirect: '/setting/access' },
      { path: 'feed-sources', redirect: '/setting/access' },
      { path: 'music-review', component: () => import('@/views/setting/SettingMusicReview.vue'), meta: { requiresAdmin: true } },
      {
        path: 'comment-moderation',
        component: () => import('@/views/setting/SettingCommentModeration.vue'),
        meta: { requiresModerator: true },
      },
      { path: 'roles', component: () => import('@/views/setting/SettingRolesView.vue'), meta: { requiresOwner: true } },
    ],
  },
]
