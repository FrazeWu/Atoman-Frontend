export type LocalBookReadingProgress = {
  reading_percent: number
  epub_cfi?: string
  updated_at: string
}

function progressKey(assetID: string) {
  return `atoman:book-reading-progress:${assetID}`
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getLocalBookReadingProgress(assetID: string): LocalBookReadingProgress | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(progressKey(assetID))
    if (!raw) return null
    const value = JSON.parse(raw) as LocalBookReadingProgress
    if (!Number.isFinite(value.reading_percent) || value.reading_percent < 0 || value.reading_percent > 1) return null
    if (typeof value.updated_at !== 'string' || !value.updated_at) return null
    return value
  } catch {
    return null
  }
}

export function saveLocalBookReadingProgress(assetID: string, progress: Pick<LocalBookReadingProgress, 'reading_percent' | 'epub_cfi'>) {
  const store = storage()
  if (!store) return
  try {
    store.setItem(progressKey(assetID), JSON.stringify({
      reading_percent: Math.max(0, Math.min(1, progress.reading_percent)),
      epub_cfi: progress.epub_cfi || '',
      updated_at: new Date().toISOString(),
    }))
  } catch {
    // Local reading progress is best-effort.
  }
}
