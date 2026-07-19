import type { RouteRecordRaw } from 'vue-router'
import { settingRoutes } from '@/router/routes/settings'

export const portalRoutes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/views/portal/PortalView.vue') },
  ...settingRoutes,
  { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
  { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
  { path: '/auth/oauth/callback', component: () => import('@/views/auth/OAuthCallbackView.vue'), meta: { authLayout: true } },
  { path: '/auth/oauth/complete-profile', component: () => import('@/views/auth/OAuthCompleteProfileView.vue'), meta: { authLayout: true } },
  { path: '/auth/oauth/confirm-account', component: () => import('@/views/auth/OAuthConfirmAccountView.vue'), meta: { authLayout: true } },
  { path: '/auth/oauth/set-password', component: () => import('@/views/auth/OAuthSetPasswordView.vue'), meta: { authLayout: true } },
  { path: '/about', component: () => import('@/views/system/AboutView.vue') },
  { path: '/terms', component: () => import('@/views/system/TermsView.vue') },
  { path: '/privacy', component: () => import('@/views/system/PrivacyView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
]
