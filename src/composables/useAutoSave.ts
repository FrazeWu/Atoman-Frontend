import { ref, onBeforeUnmount } from 'vue'

type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface StoredDraft<T> {
  payload: T
  saved_at: number
}

interface AutoSaveOptions<T> {
  getDraftKey: () => string
  getPayload: () => T
  shouldPersist?: (payload: T) => boolean
}

export function useAutoSave<T>(options: AutoSaveOptions<T>) {
  const autoSaveState = ref<AutoSaveState>('idle')
  const lastSavedAt = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  const getDraftKey = () => options.getDraftKey()
  const shouldPersist = options.shouldPersist ?? (() => true)

  function getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      return null
    }
  }

  function triggerAutoSave() {
    if (timer) clearTimeout(timer)
    autoSaveState.value = 'saving'
    timer = setTimeout(() => {
      const payload = options.getPayload()
      const storage = getStorage()
      if (!storage) {
        autoSaveState.value = 'error'
        return
      }

      try {
        if (shouldPersist(payload)) {
          const savedAt = Date.now()
          storage.setItem(
            getDraftKey(),
            JSON.stringify({ payload, saved_at: savedAt }),
          )
          lastSavedAt.value = savedAt
        } else {
          storage.removeItem(getDraftKey())
          lastSavedAt.value = null
        }
        autoSaveState.value = 'saved'
      } catch {
        autoSaveState.value = 'error'
      }
    }, 500)
  }

  function loadDraft(): StoredDraft<T> | null {
    try {
      const storage = getStorage()
      if (!storage) return null
      const saved = storage.getItem(getDraftKey())
      if (!saved) return null
      const parsed = JSON.parse(saved) as StoredDraft<T>
      if (!parsed || typeof parsed !== 'object' || !('payload' in parsed)) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  function clearDraft() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const storage = getStorage()
    if (storage) {
      try {
        storage.removeItem(getDraftKey())
      } catch {
        autoSaveState.value = 'error'
        return
      }
    }
    lastSavedAt.value = null
    autoSaveState.value = 'idle'
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return {
    autoSaveState,
    lastSavedAt,
    triggerAutoSave,
    loadDraft,
    clearDraft,
  }
}
