import { computed } from 'vue'
import * as vueRouter from 'vue-router'
import { useAuthStore } from '@/stores/auth'

function getSafeRouter() {
  try {
    if (typeof vueRouter.useRouter === 'function') {
      return vueRouter.useRouter()
    }
  } catch {}
  return undefined
}

export function useLoginRedirect() {
  const authStore = useAuthStore()
  const router = getSafeRouter()
  const isAuthenticated = computed(() => Boolean(authStore.isAuthenticated))

  function requireLogin() {
    if (isAuthenticated.value) return true
    const redirectPath = router?.currentRoute?.value?.fullPath
      || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')
    if (router?.push) {
      void router.push({ path: '/login', query: { redirect: redirectPath } })
    } else if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(redirectPath)}`
    }
    return false
  }

  return { isAuthenticated, requireLogin }
}
