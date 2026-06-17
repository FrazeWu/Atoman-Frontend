import type { RouteRecordRaw } from 'vue-router'

export const userRoutes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/posts', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/channels', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
]

export const channelRoutes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/views/blog/ChannelView.vue') },
  { path: '/posts', component: () => import('@/views/blog/ChannelView.vue') },
  { path: '/about', component: () => import('@/views/blog/ChannelView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
]
