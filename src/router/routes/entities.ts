import type { RouteRecordRaw } from 'vue-router'

export const userRoutes: RouteRecordRaw[] = [
  { path: '/users/:handle', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/users/:handle/posts', component: () => import('@/views/blog/ProfileView.vue') },
  { path: '/users/:handle/channels', component: () => import('@/views/blog/ProfileView.vue') },
]

export const channelRoutes: RouteRecordRaw[] = [
  { path: '/channels/:slug', component: () => import('@/views/blog/ChannelView.vue') },
  { path: '/channels/:slug/posts', component: () => import('@/views/blog/ChannelView.vue') },
  { path: '/channels/:slug/about', component: () => import('@/views/blog/ChannelView.vue') },
]
