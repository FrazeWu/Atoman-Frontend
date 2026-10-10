import JSZip from 'jszip'
import { createExtractorFromData } from 'node-unrar-js'
import unrarWasmURL from 'node-unrar-js/dist/js/unrar.wasm?url'

export type ComicFormat = 'cbz' | 'cbr'

export type ComicPage = {
  name: string
  blob: Blob
}

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function isComicImage(name: string) {
  const extension = name.toLowerCase().split('.').pop() || ''
  return imageExtensions.has(extension)
}

function safePageName(name: string) {
  const normalized = name.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized || normalized.split('/').some((part) => part === '..')) return null
  return normalized
}

function sortPages(names: string[]) {
  return [...names].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
}

async function extractCBZ(blob: Blob): Promise<ComicPage[]> {
  const archive = await JSZip.loadAsync(await blob.arrayBuffer())
  const names = sortPages(
    Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .map((entry) => safePageName(entry.unsafeOriginalName || entry.name))
      .filter((name): name is string => Boolean(name && isComicImage(name))),
  )
  return Promise.all(names.map(async (name) => ({
    name,
    blob: await archive.file(name)!.async('blob'),
  })))
}

async function extractCBR(blob: Blob): Promise<ComicPage[]> {
  const wasmBinary = await fetch(unrarWasmURL).then((response) => {
    if (!response.ok) throw new Error(`无法加载 CBR 解码器 (${response.status})`)
    return response.arrayBuffer()
  })
  const extractor = await createExtractorFromData({ data: await blob.arrayBuffer(), wasmBinary })
  const headers = [...extractor.getFileList().fileHeaders]
  const pages = headers
    .map((header) => ({ header, name: safePageName(header.name) }))
    .filter((entry): entry is { header: typeof entry.header; name: string } => Boolean(entry.name && !entry.header.flags.directory && !entry.header.flags.encrypted && isComicImage(entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
  const extracted = [...extractor.extract({ files: pages.map((page) => page.header.name) }).files]
  const contentByName = new Map(extracted.map((entry) => [entry.fileHeader.name, entry.extraction]))
  return pages.flatMap((page) => {
    const content = contentByName.get(page.header.name)
    return content ? [{ name: page.name, blob: new Blob([content]) }] : []
  })
}

export async function extractComicPages(blob: Blob, format: ComicFormat): Promise<ComicPage[]> {
  const pages = format === 'cbz' ? await extractCBZ(blob) : await extractCBR(blob)
  if (!pages.length) throw new Error('漫画压缩包中没有可阅读的图片')
  return pages
}
