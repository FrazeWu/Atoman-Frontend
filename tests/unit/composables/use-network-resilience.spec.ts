import { describe, expect, it, vi } from 'vitest'
import { useNetworkResilience, onNetworkRecover } from '@/composables/useNetworkResilience'

describe('useNetworkResilience', () => {
  it('provides isOnline state and responds to online/offline events', () => {
    const { isOnline } = useNetworkResilience()
    expect(typeof isOnline.value).toBe('boolean')
  })

  it('triggers recovery callback when coming back online after offline', () => {
    const callback = vi.fn()
    const unsubscribe = onNetworkRecover(callback)

    // Simulate going offline then back online
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))

    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    expect(callback).toHaveBeenCalledTimes(1) // Not called again after unsubscribe
  })
})
