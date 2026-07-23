import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useNotificationStore } from '@/stores/notification'

describe('session reset scopes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('only resets stores that belong to the logging-out Pinia instance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const firstPinia = createPinia()
    const secondPinia = createPinia()

    setActivePinia(firstPinia)
    const firstAuth = useAuthStore()
    const firstDM = useDMStore()
    const firstNotifications = useNotificationStore()
    firstDM.activeConversationId = 'first-conversation'
    firstNotifications.setDMUnread(4)

    setActivePinia(secondPinia)
    const secondDM = useDMStore()
    const secondNotifications = useNotificationStore()
    secondDM.activeConversationId = 'second-conversation'
    secondNotifications.setDMUnread(7)

    setActivePinia(firstPinia)
    await firstAuth.logout()

    expect(firstDM.activeConversationId).toBe('')
    expect(firstNotifications.unreadCounts.dm).toBe(0)
    expect(secondDM.activeConversationId).toBe('second-conversation')
    expect(secondNotifications.unreadCounts.dm).toBe(7)
  })
})
