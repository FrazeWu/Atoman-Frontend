import type { MusicAlbumImport } from '@/api/musicV1'

export type MusicImportGroup = 'draft' | 'processing' | 'failed' | 'completed'

export function musicImportAlbumTitle(item: MusicAlbumImport): string {
  return item.albumTitle?.trim()
    || item.derivedAlbumTitle?.trim()
    || '未命名专辑'
}

export function musicImportGroupForStatus(status: string): MusicImportGroup {
  if (['pending_upload', 'uploading', 'uploaded', 'ready', 'needs_attention'].includes(status)) {
    return 'draft'
  }
  if (status === 'failed') return 'failed'
  if (['committed', 'canceled'].includes(status)) return 'completed'
  return 'processing'
}

export function uniqueMusicAlbumImports(items: MusicAlbumImport[]): MusicAlbumImport[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    const targetAlbumId = item.targetAlbumId?.trim()
    const key = targetAlbumId ? `album:${targetAlbumId}` : `import:${item.importId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
