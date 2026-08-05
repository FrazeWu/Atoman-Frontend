import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function useLoginRedirect() {
  const authStore = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const isAuthenticated = computed(() => authStore.isAuthenticated)

  function requireLogin() {
    if (isAuthenticated.value) return true
    void router.push({ path: '/login', query: { redirect: route.fullPath } })
    return false
  }

  return { isAuthenticated, requireLogin }
}
