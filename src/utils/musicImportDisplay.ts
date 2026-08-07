import type { MusicAlbumImport } from '@/api/musicV1'

export type MusicImportGroup = 'in_progress' | 'needs_attention' | 'published' | 'canceled'

export function musicImportAlbumTitle(item: MusicAlbumImport): string {
  return item.albumTitle?.trim()
    || item.derivedAlbumTitle?.trim()
    || '未命名专辑'
}

export function musicImportGroupForStatus(status: string): MusicImportGroup {
  if (status === 'committed') return 'published'
  if (status === 'canceled') return 'canceled'
  if (['needs_attention', 'failed'].includes(status)) return 'needs_attention'
  return 'in_progress'
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
