import JSZip from 'jszip'

const audioExtensions = new Set([
  'mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'aif', 'wma', 'ape', 'alac',
])

function nameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim()
}

function trackTitle(fileName: string): string {
  return nameWithoutExtension(fileName)
    .replace(/^\s*(?:\d{1,3}|\d{1,2}-\d{1,3})\s*[-_.]\s*/, '')
    .trim()
}

function isAudioPath(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return !!extension && audioExtensions.has(extension)
}

export type MusicAlbumImportPreview = {
  title: string
  tracks: string[]
}

export async function readAlbumImportPreview(file: File): Promise<MusicAlbumImportPreview> {
  const title = nameWithoutExtension(file.name)
  if (!file.name.toLowerCase().endsWith('.zip')) return { title, tracks: [] }

  const archive = await JSZip.loadAsync(file)
  const tracks = Object.values(archive.files)
    .filter((entry) => !entry.dir && isAudioPath(entry.name))
    .map((entry) => trackTitle(entry.name.split('/').pop() ?? entry.name))
    .filter(Boolean)

  return { title, tracks }
}
