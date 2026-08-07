import { reactive } from 'vue'

export interface ShortNoteStateSync {
  liked?: boolean
  likeCount?: number
  commentCount?: number
}

const syncStore = reactive(new Map<string, ShortNoteStateSync>())

export function useShortNoteSync() {
  function getNoteState(id: string) {
    return syncStore.get(id)
  }

  function updateNoteState(id: string, state: Partial<ShortNoteStateSync>) {
    const current = syncStore.get(id) || {}
    syncStore.set(id, { ...current, ...state })
  }

  return {
    getNoteState,
    updateNoteState,
  }
}
