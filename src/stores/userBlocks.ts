import { apiRequestResult } from '@/api/client'
import { defineStore, getActivePinia } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { registerSessionReset } from '@/stores/sessionReset'
import type { BlockedUser } from '@/types'

export const useUserBlocksStore = defineStore('userBlocks', () => {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('拉黑状态必须在 Pinia 实例中创建')
  const api = useApi()
  const authStore = useAuthStore()
  const blockedUsers = ref<BlockedUser[]>([])
  const loading = ref(false)
  let requestGeneration = 0

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const fetchBlockedUsers = async () => {
    if (!authStore.token) return
    const generation = ++requestGeneration
    const token = authStore.token
    const userID = authStore.user?.uuid
    loading.value = true
    try {
      const res = await apiRequestResult(api.users.blocked, { headers: authHeaders() })
      if (generation !== requestGeneration || token !== authStore.token || userID !== authStore.user?.uuid) return
      if (!res.ok) throw new Error('获取拉黑列表失败')
      blockedUsers.value = res.data.data || []
    } finally {
      if (generation === requestGeneration) loading.value = false
    }
  }

  const blockUser = async (userUuid: string) => {
    const res = await apiRequestResult(api.users.block(userUuid), { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error('拉黑失败')
    await fetchBlockedUsers()
  }

  const unblockUser = async (userUuid: string) => {
    const res = await apiRequestResult(api.users.block(userUuid), { method: 'DELETE', headers: authHeaders() })
    if (!res.ok) throw new Error('取消拉黑失败')
    blockedUsers.value = blockedUsers.value.filter((item) => item.blocked_id !== userUuid)
  }

  const resetStore = () => {
    requestGeneration += 1
    blockedUsers.value = []
    loading.value = false
  }
  onScopeDispose(registerSessionReset(pinia, resetStore))

  return { blockedUsers, loading, fetchBlockedUsers, blockUser, unblockUser, resetStore }
})
