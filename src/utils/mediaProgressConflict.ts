import type { BookReadingState, SaveBookReadingStateInput } from '@/api/books'
import type { ContentProgress } from '@/composables/useContentLifecycle'

type BookProgressWithBookmarks = SaveBookReadingStateInput & {
  preferences?: Record<string, unknown>
}

function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function mergeBookReadingProgress(local: BookProgressWithBookmarks, remote: BookReadingState | null): SaveBookReadingStateInput {
  if (!remote) return local
  const localPercent = finite(local.reading_percent)
  const remotePercent = finite(remote.reading_percent)
  const useRemotePosition = remotePercent > localPercent
  const localPreferences = local.preferences || {}
  const remotePreferences = remote.preferences || {}
  const localBookmarks = Array.isArray(localPreferences.bookmarks) ? localPreferences.bookmarks : []
  const remoteBookmarks = Array.isArray(remotePreferences.bookmarks) ? remotePreferences.bookmarks : []
  const bookmarks = [...remoteBookmarks, ...localBookmarks].filter((bookmark, index, all) => {
    if (!bookmark || typeof bookmark !== 'object') return false
    const id = (bookmark as { id?: unknown }).id
    return typeof id === 'string' && all.findIndex((candidate) => candidate && typeof candidate === 'object' && (candidate as { id?: unknown }).id === id) === index
  })
  return {
    ...local,
    epub_cfi: useRemotePosition ? remote.epub_cfi || local.epub_cfi || '' : local.epub_cfi || remote.epub_cfi || '',
    pdf_page: Math.max(finite(local.pdf_page, 1), finite(remote.pdf_page, 1)),
    txt_offset: Math.max(finite(local.txt_offset), finite(remote.txt_offset)),
    reading_percent: Math.max(localPercent, remotePercent),
    private_notes: local.private_notes || remote.private_notes || '',
    preferences: {
      ...remotePreferences,
      ...localPreferences,
      bookmarks,
    },
  }
}

export function pickLatestMediaProgress<T extends { progress?: number; updated_at?: string }>(local: T | null, remote: T | null): T | null {
  if (!local) return remote
  if (!remote) return local
  const localTime = Date.parse(local.updated_at || '')
  const remoteTime = Date.parse(remote.updated_at || '')
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime !== remoteTime) return remoteTime > localTime ? remote : local
  return finite(remote.progress) > finite(local.progress) ? remote : local
}
