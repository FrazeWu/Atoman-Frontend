import { reactive } from 'vue'

export interface ShortNoteStateSync {
  liked?: boolean
  likeCount?: number
  dislikeCount?: number
  viewerVote?: 'up' | 'down' | 'none'
  commentCount?: number
  read?: boolean
}

const STORAGE_KEY = 'atoman:read_short_notes'

function getInitialReadIds(): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return new Set(JSON.parse(raw))
    }
  } catch {
    // ignore
  }
  return new Set()
}

const readIds = reactive<Set<string>>(getInitialReadIds())
const syncStore = reactive(new Map<string, ShortNoteStateSync>())

function persistReadIds() {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readIds)))
		}
	} catch {
		// ignore
	}
}

export function useShortNoteSync() {
  function getNoteState(id: string) {
    return syncStore.get(id)
  }

  function isNoteRead(id: string): boolean {
    return readIds.has(id) || syncStore.get(id)?.read === true
  }

  function markNoteAsRead(id: string) {
    readIds.add(id)
    const current = syncStore.get(id) || {}
    syncStore.set(id, { ...current, read: true })
    persistReadIds()
  }

  function updateNoteState(id: string, state: Partial<ShortNoteStateSync>) {
    const current = syncStore.get(id) || {}
    syncStore.set(id, { ...current, ...state })
    if (state.read) {
      readIds.add(id)
      persistReadIds()
    }
  }

  return {
    getNoteState,
    updateNoteState,
    isNoteRead,
    markNoteAsRead,
  }
}
