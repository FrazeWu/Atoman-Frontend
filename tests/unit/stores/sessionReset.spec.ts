import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useNotificationStore } from '@/stores/notification'
import { clearSessionStores } from '@/stores/sessionReset'

describe('session reset scopes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('only resets stores that belong to the logging-out Pinia instance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const firstPinia = createPinia()
    const secondPinia = createPinia()

    const firstAuth = useAuthStore(firstPinia)
    const firstDM = useDMStore(firstPinia)
    const firstNotifications = useNotificationStore(firstPinia)
    firstDM.activeConversationId = 'first-conversation'
    firstNotifications.setDMUnread(4)

    const secondDM = useDMStore(secondPinia)
    const secondNotifications = useNotificationStore(secondPinia)
    secondDM.activeConversationId = 'second-conversation'
    secondNotifications.setDMUnread(7)

    await firstAuth.logout()

    expect(firstDM.activeConversationId).toBe('')
    expect(firstNotifications.unreadCounts.dm).toBe(0)
    expect(secondDM.activeConversationId).toBe('second-conversation')
    expect(secondNotifications.unreadCounts.dm).toBe(7)
  })

  it('unregisters a disposed store callback from its Pinia scope', () => {
    const pinia = createPinia()
    const dm = useDMStore(pinia)
    dm.activeConversationId = 'disposed-conversation'

    dm.$dispose()
    clearSessionStores(pinia)

    expect(dm.activeConversationId).toBe('disposed-conversation')
  })
})
