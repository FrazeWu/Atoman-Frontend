import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isMobileDetailRoute } from '../mobileRouteMeta'

export type MobileRouteMotion = '' | 'mobile-route-forward' | 'mobile-route-back' | 'mobile-route-switch'

function pathOf(fullPath: string) {
  return fullPath.split(/[?#]/)[0] || '/'
}

function historyPosition(): number | null {
  if (typeof window === 'undefined') return null
  const position = window.history.state?.position
  return typeof position === 'number' && Number.isFinite(position) ? position : null
}

/** Only animate actual page changes. Query filters on one page should not remount or slide it. */
export function resolveMobileRouteMotion(to: string, from: string, isHistoryBack = false): MobileRouteMotion {
  if (!from || to === from) return ''
  const toPath = pathOf(to)
  const fromPath = pathOf(from)
  if (toPath === fromPath) {
    // /feed?source_id=... swaps between the stream and a source landing component.
    return toPath === '/feed' && (to.includes('source_id=') || from.includes('source_id='))
      ? 'mobile-route-switch'
      : ''
  }
  if (isHistoryBack) return 'mobile-route-back'
  const fromDetail = isMobileDetailRoute(fromPath)
  const toDetail = isMobileDetailRoute(toPath)
  if (toDetail) return 'mobile-route-forward'
  if (fromDetail) return 'mobile-route-back'
  return 'mobile-route-switch'
}

/** Prevent the outgoing nested view and its parent outlet from animating twice. */
export function resolveScopedMobileRouteMotion(to: string, from: string, scopeRoot: string, isHistoryBack = false): MobileRouteMotion {
  if (scopeRoot && ![to, from].every(path => {
    const routePath = pathOf(path)
    return routePath === scopeRoot || routePath.startsWith(`${scopeRoot}/`)
  })) return ''
  return resolveMobileRouteMotion(to, from, isHistoryBack)
}

/** Nested outlets only animate within their own section; the root outlet handles cross-space navigation. */
export function useMobileRouteMotion(scopeRoot = '') {
  const route = useRoute()
  const motion = ref<MobileRouteMotion>('')
  let previousPosition = historyPosition()
  watch(() => route.fullPath, (to, from) => {
    const position = historyPosition()
    const goingBack = position !== null && previousPosition !== null && position < previousPosition
    motion.value = resolveScopedMobileRouteMotion(to, from, scopeRoot, goingBack)
    previousPosition = position
  }, { flush: 'sync' })
  return motion
}
