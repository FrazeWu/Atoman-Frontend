import type { RouteRecordRaw } from 'vue-router'

export const userRoutes: RouteRecordRaw[] = [
  { path: '/users/:handle', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/users/:handle/posts', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/users/:handle/channels', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/users/:handle/settings', component: () => import('@/views/user/UserSettingsView.vue'), meta: { requiresAuth: true } },
]

export const channelRoutes: RouteRecordRaw[] = [
  {
    path: '/channels/:slug',
    redirect: (to) => ({
      path: `/posts/channel/${String(to.params.slug)}`,
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/channels/:slug/posts',
    redirect: (to) => ({
      path: `/posts/channel/${String(to.params.slug)}`,
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/channels/:slug/about',
    redirect: (to) => ({
      path: `/posts/channel/${String(to.params.slug)}`,
      query: to.query,
      hash: to.hash,
    }),
  },
]
