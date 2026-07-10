import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { BlockedUser } from '@/types'

export const useUserBlocksStore = defineStore('userBlocks', () => {
  const api = useApi()
  const authStore = useAuthStore()
  const blockedUsers = ref<BlockedUser[]>([])
  const loading = ref(false)

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const fetchBlockedUsers = async () => {
    if (!authStore.token) return
    loading.value = true
    try {
      const res = await fetch(api.users.blocked, { headers: authHeaders() })
      if (!res.ok) throw new Error('获取拉黑列表失败')
      const data = await res.json()
      blockedUsers.value = data.data || []
    } finally {
      loading.value = false
    }
  }

  const blockUser = async (userUuid: string) => {
    const res = await fetch(api.users.block(userUuid), { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error('拉黑失败')
    await fetchBlockedUsers()
  }

  const unblockUser = async (userUuid: string) => {
    const res = await fetch(api.users.block(userUuid), { method: 'DELETE', headers: authHeaders() })
    if (!res.ok) throw new Error('取消拉黑失败')
    blockedUsers.value = blockedUsers.value.filter((item) => item.blocked_id !== userUuid)
  }

  return { blockedUsers, loading, fetchBlockedUsers, blockUser, unblockUser }
})
