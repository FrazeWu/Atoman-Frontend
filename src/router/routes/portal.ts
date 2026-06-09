import type { RouteRecordRaw } from 'vue-router'
import { settingRoutes } from '@/router/routes/settings'

export const portalRoutes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/views/PortalView.vue') },
  ...settingRoutes,
  { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/about', component: () => import('@/views/music/AboutView.vue') },
  { path: '/terms', component: () => import('@/views/TermsView.vue') },
  { path: '/privacy', component: () => import('@/views/PrivacyView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFoundView.vue') },
]
