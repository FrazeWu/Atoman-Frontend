import { describe, expect, it } from 'vitest'
import { useRequestGeneration } from '@/composables/useRequestGeneration'

describe('useRequestGeneration', () => {
  it('marks earlier requests stale when a later request starts', () => {
    const requests = useRequestGeneration()
    const first = requests.beginRequest()
    const second = requests.beginRequest()

    expect(first.isCurrent()).toBe(false)
    expect(second.isCurrent()).toBe(true)
    expect(requests.isCurrent(second.generation)).toBe(true)
  })
})
