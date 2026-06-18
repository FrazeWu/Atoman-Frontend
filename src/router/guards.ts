import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { onboardingSteps, useOnboardingStore, type OnboardingStep } from '@/stores/onboarding'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { resolveSiteContext } from '@/router/siteContext'
import { isAdminRole, isOwnerRole } from '@/utils/roles'

const disabledTarget = { path: '/__disabled__' }

function parseOnboardingStep(value: unknown): OnboardingStep | null {
  return typeof value === 'string' && onboardingSteps.includes(value as OnboardingStep)
    ? value as OnboardingStep
    : null
}

export function installRouteGuards(router: Router) {
  router.beforeEach(async (to, from) => {
    const currentRouteSite = typeof from.query.site === 'string' ? from.query.site : null
    const browserSite = new URLSearchParams(window.location.search).get('site')
    const explicitSite = currentRouteSite || browserSite
    if (explicitSite && !('site' in to.query)) {
      return { path: to.path, query: { ...to.query, site: explicitSite }, hash: to.hash }
    }

    const authStore = useAuthStore()
    const onboardingStore = useOnboardingStore()
    const siteAccessStore = useSiteAccessStore()
    const hasValidSession = authStore.validateSession() || await authStore.restoreSession()
    const onboardingStep = parseOnboardingStep(to.query.onboarding_step)

    if (hasValidSession) {
      onboardingStore.initialize(authStore.user, onboardingStep)
    } else {
      onboardingStore.reset()
    }

    if (onboardingStep) {
      const query = { ...to.query }
      delete query.onboarding_step
      return { path: to.path, query, hash: to.hash, replace: true }
    }

    if (!siteAccessStore.loaded && !siteAccessStore.loading) {
      await siteAccessStore.load()
    }

    if (to.meta.requiresAuth && !hasValidSession) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (to.meta.requiresAdmin && !isAdminRole(authStore.user?.role)) {
      return '/'
    }
    if (to.meta.requiresOwner && !isOwnerRole(authStore.user?.role)) {
      return '/setting'
    }

    const isSettingRoute = to.path === '/setting' || to.path.startsWith('/setting/')
    const isDisabledTarget = to.path === disabledTarget.path

    if (!isSettingRoute && !isDisabledTarget) {
      const context = resolveSiteContext(window.location.hostname, window.location.search)
      if (context.type === 'module' && !siteAccessStore.isModuleVisible(context.module)) {
        return disabledTarget
      }
    }

    const featureGate = to.meta.featureGate as { module: Parameters<typeof siteAccessStore.isFeatureEnabled>[0]; feature: Parameters<typeof siteAccessStore.isFeatureEnabled>[1] } | undefined
    if (!isSettingRoute && !isDisabledTarget && featureGate && !siteAccessStore.isFeatureEnabled(featureGate.module, featureGate.feature)) {
      return disabledTarget
    }
  })
}
