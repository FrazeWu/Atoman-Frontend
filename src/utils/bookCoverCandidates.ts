import JSZip from 'jszip'
import { extractComicPages } from './bookComicArchive'
import { loadPdfEngine } from './bookReaderEngines'
import { extractBookPdfMetadata, type BookPdfTextMetadata } from './bookPdfMetadata'

export interface BookCoverCandidate { label: string; dataUrl: string }
export interface BookIdentifiedMetadata {
  title?: string
  author?: string
  language?: string
  publisher?: string
  isbn?: string
  publishedDate?: string // YYYY-MM
  editionStatement?: string
  pageCount?: number
  sources?: BookPdfTextMetadata['sources']
}
export interface BookInspection {
  candidates: BookCoverCandidate[]
  metadata: BookIdentifiedMetadata
  explanation: string
}

function isValidISBN(value: string) {
  if (/^[0-9]{9}[0-9X]$/.test(value)) {
    return [...value].reduce((sum, digit, index) => sum + (10 - index) * (digit === 'X' ? 10 : Number(digit)), 0) % 11 === 0
  }
  if (/^[0-9]{13}$/.test(value)) {
    return [...value].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0) % 10 === 0
  }
  return false
}
function detectedISBN(text: string): string | undefined {
  const matches = text.match(/(?:ISBN(?:-1[03])?[\s:：-]*)?((?:97[89][\s-]*)?[0-9][0-9\s-]{8,15}[0-9X])/gi) || []
  for (const match of matches) {
    const value = match.replace(/[^0-9X]/gi, '').toUpperCase()
    if (isValidISBN(value)) return value
  }
}
function detectedPublisher(text: string): string | undefined {
  return text.match(/([\p{Script=Han}]{2,16}出版社)/u)?.[1]
}
function asJPEG(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const ratio = Math.min(1, 550 / image.width, 800 / image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * ratio))
      canvas.height = Math.max(1, Math.round(image.height * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('浏览器不能处理图片')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.84))
    }
    image.onerror = () => reject(new Error('无法解码封面图片'))
    image.src = dataUrl
  })
}
async function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取封面失败'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })
}
export async function coverFromFile(image: Blob): Promise<string> {
  if (!image.size || image.size > 15 * 1024 * 1024) throw new Error('封面图片为空或超过 15MB')
  // JSZip and the comic extractor return Blobs without MIME types.
  const prefix = new Uint8Array(await image.slice(0, 16).arrayBuffer())
  const jpg = prefix[0] === 0xff && prefix[1] === 0xd8
  const png = prefix[0] === 0x89 && prefix[1] === 0x50 && prefix[2] === 0x4e && prefix[3] === 0x47
  const webp = String.fromCharCode(...prefix.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...prefix.slice(8, 12)) === 'WEBP'
  const mime = jpg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : ''
  if (!mime) throw new Error('请选择有效的 JPEG、PNG 或 WebP 图片')
  return asJPEG(await blobAsDataUrl(new Blob([image], { type: mime })))
}
async function inspectPdf(file: File): Promise<BookInspection> {
  const { getDocument } = await loadPdfEngine()
  const objectUrl = URL.createObjectURL(file)
  const loader = getDocument({ url: objectUrl })
  try {
    const doc = await loader.promise
    const candidates: BookCoverCandidate[] = []
    const textFragments: string[] = []
    // Cover previews and bibliographic detection are distinct tasks: the
    // example 三体 has its copyright/CIP information on PDF page SIX.
    const maxMetadataPages = Math.min(20, doc.numPages)
    for (let i = 1; i <= maxMetadataPages; i++) {
      const page = await doc.getPage(i)
      if (i <= 5) {
        const width = page.getViewport({ scale: 1 }).width
        const viewport = page.getViewport({ scale: Math.min(1.1, 460 / Math.max(width, 1)) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          candidates.push({ label: '第 ' + i + ' 页', dataUrl: canvas.toDataURL('image/jpeg', 0.83) })
        }
      }
      const content = await page.getTextContent()
      textFragments.push(content.items.map(item => {
        if (!('str' in item)) return ''
        return String(item.str) + ('hasEOL' in item && item.hasEOL ? '\n' : ' ')
      }).join(''))
      page.cleanup()
      if (i >= 5) {
        const found = extractBookPdfMetadata(textFragments)
        if (found.title && found.author && found.isbn && found.publisher && found.publishedDate) break
      }
    }
    const info = (await doc.getMetadata().catch(() => null))?.info as { Title?: string; Author?: string } | undefined
    const data = extractBookPdfMetadata(textFragments, info)
    const evidence = data.sources.isbn?.page || data.sources.title?.page
    return {
      candidates,
      metadata: { ...data, pageCount: doc.numPages },
      explanation: `封面取自前五页；书目信息检查了前 ${textFragments.length} 页` +
        (evidence ? `，在第 ${evidence} 页发现可提取的版权资料。` : '，未找到可确认的版权记录；可手动补充。'),
    }
  } finally {
    await loader.destroy()
    URL.revokeObjectURL(objectUrl)
  }
}
function xmlElements(doc: Document, tag: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS('*', tag))
}
async function inspectEpub(file: File): Promise<BookInspection> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer())
  const container = await archive.file('META-INF/container.xml')?.async('text')
  if (!container) throw new Error('EPUB 缺少容器清单')
  const parser = new DOMParser()
  const root = parser.parseFromString(container, 'application/xml')
  const opfPath = root.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
  if (!opfPath || opfPath.includes('..')) throw new Error('EPUB 清单路径无效')
  const opfText = await archive.file(opfPath)?.async('text')
  if (!opfText) throw new Error('无法读取 EPUB 书目信息')
  const opf = parser.parseFromString(opfText, 'application/xml')
  const text = (tag: string) => xmlElements(opf, tag)[0]?.textContent?.trim() || undefined
  const imageItems = xmlElements(opf, 'item').filter(item => {
    const mediaType = item.getAttribute('media-type') || ''
    return mediaType.startsWith('image/')
  })
  const coverId = xmlElements(opf, 'meta').find(item => item.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = imageItems.find(item => item.getAttribute('properties')?.split(' ').includes('cover-image') || item.getAttribute('id') === coverId)
  const ordered = coverItem ? [coverItem, ...imageItems.filter(item => item !== coverItem)] : imageItems
  const folder = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const candidates: BookCoverCandidate[] = []
  for (const item of ordered.slice(0, 5)) {
    const relative = item.getAttribute('href') || ''
    const decoded = decodeURIComponent(relative.split('#')[0])
    if (!decoded || decoded.split('/').includes('..')) continue
    const entry = archive.file(folder + decoded)
    if (!entry) continue
    try {
      const binary = await entry.async('blob')
      candidates.push({ label: candidates.length === 0 && item === coverItem ? '内嵌封面' : '候选 ' + (candidates.length + 1), dataUrl: await coverFromFile(binary) })
    } catch { /* A broken image is not a valid cover candidate. */ }
  }
  const identifiers = xmlElements(opf, 'identifier').map(item => item.textContent?.trim() || '').join(' ')
  return {
    candidates,
    metadata: {
      title: text('title'),
      author: text('creator'),
      language: text('language'),
      publisher: text('publisher'),
      isbn: detectedISBN(identifiers),
      publishedDate: text('date'),
    },
    explanation: '优先提取 EPUB 内嵌封面；EPUB 没有固定页码，其余候选来自书内前几张图片。',
  }
}
async function inspectComic(file: File, ext: 'cbz' | 'cbr'): Promise<BookInspection> {
  const pages = await extractComicPages(file, ext)
  const candidates: BookCoverCandidate[] = []
  for (const [index, page] of pages.slice(0, 5).entries()) {
    candidates.push({ label: '第 ' + (index + 1) + ' 张', dataUrl: await coverFromFile(page.blob) })
  }
  return { candidates, metadata: {}, explanation: '已提取漫画文件前五张图片。' }
}
export async function inspectBookCoverCandidates(file: File): Promise<BookInspection> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return inspectPdf(file)
  if (ext === 'epub') return inspectEpub(file)
  if (ext === 'cbz' || ext === 'cbr') return inspectComic(file, ext)
  return { candidates: [], metadata: {}, explanation: '此格式没有可提取的固定封面，请手动上传封面图片。' }
}
