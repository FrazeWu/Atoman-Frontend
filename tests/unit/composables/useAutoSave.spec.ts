import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoSave } from '@/composables/useAutoSave'

describe('useAutoSave', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('enters error state when local draft persistence fails', async () => {
    vi.useFakeTimers()
    const failingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => undefined,
    } as unknown as Storage
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(failingStorage)

    const autoSave = useAutoSave({
      getDraftKey: () => 'draft-key',
      getPayload: () => ({ title: 'draft title' }),
    })

    autoSave.triggerAutoSave()
    await vi.advanceTimersByTimeAsync(500)

    expect(autoSave.autoSaveState.value).toBe('error')
    expect(autoSave.lastSavedAt.value).toBeNull()
  })
})
