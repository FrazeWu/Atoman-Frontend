import { describe, expect, it } from 'vitest'

import { batchFlagPayload, batchPauseValue, selectedSubscriptionIds } from '@/utils/subscriptionBatch'

describe('subscription batch helpers', () => {
  it('serializes selected IDs and flag payloads', () => {
    expect(selectedSubscriptionIds(new Set(['one', 'two']))).toEqual(['one', 'two'])
    expect(batchFlagPayload('is_muted', true)).toEqual({ is_muted: true })
  })

  it('maps pause operations to explicit nullable state', () => {
    expect(batchPauseValue('pause')).toBe(true)
    expect(batchPauseValue('resume')).toBe(false)
    expect(batchPauseValue('sync')).toBeNull()
  })
})
