import type { PaperFile, PaperUpload } from '@/api/papers'
import { paperResourceBlob, preparePaperUploads } from './fileTools'

export const figurePlacementOptions = [
  { value: 'htbp', label: '自动浮动 (htbp)' },
  { value: 't', label: '页顶 (t)' },
  { value: 'b', label: '页底 (b)' },
  { value: 'p', label: '独立浮动页 (p)' },
  { value: 'h', label: '尽量当前位置 (h)' },
] as const
export type FigurePlacement = typeof figurePlacementOptions[number]['value']
export interface FigureOptions {
  path: string
  width: number
  placement: FigurePlacement
  caption: string
  label: string
  wide: boolean
}
export interface FigureInsertion {
  id: string
  revision: number
  path: string
  code: string
}

export function isFigurePath(path: string): boolean {
  const bytes = new TextEncoder()
  return bytes.encode(path).length <= 512 && /\.(png|jpe?g|pdf)$/i.test(path) &&
    path.split('/').every(part => part.length > 0 && bytes.encode(part).length <= 255 &&
      part === part.trim() && !part.startsWith('.') && !part.endsWith('.') &&
      /^[\p{L}\p{N}\p{M}_. ()-]+$/u.test(part))
}

export function isFigureFile(file: Pick<PaperFile, 'kind' | 'path'>): boolean {
  return file.kind === 'binary' && isFigurePath(file.path)
}

export function suggestedFigureLabel(path: string): string {
  const stem = path.replace(/^figures\//i, '').replace(/\.[^.]+$/, '')
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
  let hash = 2166136261
  for (const char of path) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619)
  // Include a short stable suffix so different paths with the same slug
  // (including non-Latin filenames) get different suggested keys.
  return 'fig:' + (slug || 'image') + '-' + (hash >>> 0).toString(36)
}

const captionEscapes: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$',
  '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
}

export function escapeFigureCaption(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/[\\{}$&#%_~^]/g, ch => captionEscapes[ch]!)
}

export function makeFigureCode(options: FigureOptions): string {
  if (!isFigurePath(options.path)) throw new Error('图片路径不符合 LaTeX 项目文件规范，请先重命名。')
  if (!Number.isInteger(options.width) || options.width < 10 || options.width > 100)
    throw new Error('图片宽度必须是 10–100% 的整数。')
  if (!figurePlacementOptions.some(p => p.value === options.placement))
    throw new Error('请选择有效的浮动位置。')
  const caption = options.caption.trim()
  const label = options.label.trim()
  if (caption.length > 400 || /[\p{Cc}\p{Cf}]/u.test(caption.replace(/[\r\n\t]/g, '')))
    throw new Error('图注不得超过 400 个字符，也不能包含控制字符。')
  if (label && !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/.test(label))
    throw new Error('引用标签只能包含英文字母、数字、冒号、点、下划线或连字符，最多 100 字符。')
  if (label && !caption) throw new Error('带引用标签的图片需要图注。')
  const env = options.wide ? 'figure*' : 'figure'
  const width = String(options.width / 100)
  const lines = [
    '\\begin{' + env + '}[' + options.placement + ']',
    '  \\centering',
    '  \\includegraphics[width=' + width + '\\linewidth]{' + options.path + '}',
  ]
  if (caption) lines.push('  \\caption{' + escapeFigureCaption(caption) + '}')
  if (label) lines.push('  \\label{' + label + '}')
  lines.push('\\end{' + env + '}')
  return lines.join('\n')
}

export async function prepareFigureUploads(files: File[], directory: string): Promise<PaperUpload[]> {
  if (!files.length || files.some(f => !isFigurePath(f.name) || f.name.includes('/')))
    throw new Error('请拖入 PNG、JPEG 或 PDF 文件，文件名不能包含特殊字符。')
  const uploads = await preparePaperUploads(files, directory)
  for (const file of uploads) {
    if (!isFigurePath(file.path) || !paperResourceBlob(file))
      throw new Error('图片路径或文件格式无法识别：' + file.path)
  }
  return uploads
}
