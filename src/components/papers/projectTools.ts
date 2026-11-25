import type { PaperFile, PaperTextReplacement } from '@/api/papers'

export interface ProjectMatch { fileId: string; path: string; revision: number; line: number; column: number; preview: string }
export interface ProjectSearch { total: number; matches: ProjectMatch[] }

export function searchProject(files: readonly PaperFile[], query: string): ProjectSearch {
  const result: ProjectSearch = { total: 0, matches: [] }
  if (!query || query.includes('\n')) return result
  for (const file of files) {
    if (file.kind !== 'text') continue
    for (const [index, line] of file.content.split('\n').entries()) {
      let from = 0
      while (from <= line.length) {
        const at = line.indexOf(query, from)
        if (at < 0) break
        result.total++
        if (result.matches.length < 200) {
          result.matches.push({ fileId: file.id, path: file.path, revision: file.revision, line: index + 1, column: at + 1, preview: line.slice(Math.max(0, at - 50), at + query.length + 80) })
        }
        from = at + query.length
      }
    }
  }
  return result
}

// Compute size before allocating replacement text. Use a callback so dollar
// sequences such as "$&" are treated as literal LaTeX, not JS substitution.
export function planProjectReplacement(files: readonly PaperFile[], query: string, replacement: string): PaperTextReplacement[] {
  if (!query || query.includes('\n') || query === replacement) return []
  const encoder = new TextEncoder()
  const result: PaperTextReplacement[] = []
  let bytes = 0
  const delta = encoder.encode(replacement).byteLength - encoder.encode(query).byteLength
  for (const file of files) {
    if (file.kind !== 'text') continue
    const count = searchProject([file], query).total
    if (!count) continue
    const nextBytes = encoder.encode(file.content).byteLength + count * delta
    if (nextBytes > 1024 * 1024 || nextBytes < 0 || bytes + nextBytes > 4 * 1024 * 1024) throw new Error('替换后的源码超过项目容量限制。')
    const content = file.content.replaceAll(query, () => replacement)
    bytes += nextBytes
    result.push({ file_id: file.id, base_revision: file.revision, content })
  }
  return result
}

export interface PaperReference { key: string; title: string; fileId: string; path: string; line: number }

export function bibtexReferences(files: readonly PaperFile[]): PaperReference[] {
  const results: PaperReference[] = []
  for (const file of files) {
    if (file.kind !== 'text' || !/\.bib$/i.test(file.path)) continue
    const text = file.content
    const start = /^[ \t]*@([A-Za-z]+)\s*([{(])/gm
    let m: RegExpExecArray | null
    while ((m = start.exec(text)) && results.length < 2000) {
      const opener = m[2]!, closer = opener === '{' ? '}' : ')'
      const bodyStart = start.lastIndex
      let depth = 1, braces = 0, quote = false, j = bodyStart
      for (; j < text.length; j++) {
        const c = text[j]!
        if (c === '\\') { j++; continue }
        if (c === '"' && (opener === '{' ? depth === 1 : braces === 0)) { quote = !quote; continue }
        if (opener === '(') {
          if (c === '{') braces++
          if (c === '}' && braces > 0) braces--
          if (braces || quote) continue
        } else if (quote) continue
        if (c === opener) depth++
        if (c === closer && --depth === 0) break
      }
      // Incomplete entries are not safe citation suggestions.
      if (depth !== 0) break
      start.lastIndex = j + 1
      if (/^(comment|string|preamble)$/i.test(m[1]!)) continue
      const body = text.slice(bodyStart, j)
      const keyMatch = /^\s*([^\s,{}()%]+)\s*,/.exec(body)
      if (!keyMatch || /[\\%]/.test(keyMatch[1]!)) continue
      const title = /(?:^|,)\s*title\s*=\s*(?:\{([^\n]{0,400})|"([^"\n]{0,400})")/i.exec(body)
      const caption = (title?.[1] || title?.[2] || '').split(/\},\s*\w+\s*=/)[0]!.replace(/[{}]+$/g,'').trim().slice(0, 200)
      results.push({ key: keyMatch[1]!, title: caption, fileId: file.id, path: file.path, line: text.slice(0, m.index).split('\n').length })
    }
  }
  return results
}

export function changedLineRange(oldText: string, newText: string): { from: number; oldTo: number; newTo: number } | null {
  if (oldText === newText) return null
  const a = oldText.split('\n'), b = newText.split('\n')
  let first = 0, end = 0
  while (first < Math.min(a.length, b.length) && a[first] === b[first]) first++
  while (end < Math.min(a.length, b.length) - first && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  return { from: first + 1, oldTo: a.length - end, newTo: b.length - end }
}
