import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { resolveSiteContext } from '@/router/siteContext'
import { isAdminRole, isModeratorRole, isOwnerRole } from '@/utils/roles'

const disabledTarget = { path: '/__disabled__' }
const publicSystemPaths = new Set([
  '/login',
  '/register',
  '/auth/oauth/callback',
  '/auth/oauth/complete-profile',
  '/auth/oauth/confirm-account',
  '/auth/oauth/set-password',
  '/about',
  '/terms',
  '/privacy',
  '/__not_found__',
  disabledTarget.path,
])

export function installRouteGuards(router: Router) {
  router.beforeEach(async (to, from) => {
    const authStore = useAuthStore()
    const onboardingStore = useOnboardingStore()
    const siteAccessStore = useSiteAccessStore()
    const isSettingRoute = to.path === '/site/setting'
    const isPublicSystemRoute = publicSystemPaths.has(to.path)
    const hasValidSession = authStore.validateSession() || await authStore.restoreSession()

    if (hasValidSession) {
      onboardingStore.initialize(authStore.user)
    } else {
      onboardingStore.reset()
    }

    if (!isSettingRoute && !isPublicSystemRoute && !siteAccessStore.loaded && !siteAccessStore.loading) {
      try {
        await siteAccessStore.load()
      } catch {
        // Fail open with the default access config so a transient settings API
        // failure does not make the whole site unreachable.
      }
    }

    if (to.meta.requiresAuth && !hasValidSession) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (to.meta.requiresModerator && !isModeratorRole(authStore.user?.role)) {
      return '/'
    }
    if (to.meta.requiresAdmin && !isAdminRole(authStore.user?.role)) {
      return '/'
    }
    if (to.meta.requiresOwner && !isOwnerRole(authStore.user?.role)) {
      return '/setting'
    }

    if (!isSettingRoute && !isPublicSystemRoute) {
      const targetUrl = new URL(to.fullPath, window.location.origin)
      const context = resolveSiteContext(window.location.hostname, targetUrl.search, to.path)
      if (context.type === 'module' && !siteAccessStore.isModuleVisible(context.module)) {
        return disabledTarget
      }
    }

    const featureGate = to.meta.featureGate as { module: Parameters<typeof siteAccessStore.isFeatureEnabled>[0]; feature: Parameters<typeof siteAccessStore.isFeatureEnabled>[1] } | undefined
    if (!isSettingRoute && !isPublicSystemRoute && featureGate && !siteAccessStore.isFeatureEnabled(featureGate.module, featureGate.feature)) {
      return disabledTarget
    }
  })
}
