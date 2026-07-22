import { commonmarkLanguage } from '@codemirror/lang-markdown'

import type { DebateResourceKind } from '@/types'

export const resourceKinds = [
  'post',
  'thread',
  'debate',
  'feed',
  'article',
  'artist',
  'album',
  'song',
  'playlist',
  'podcast',
  'episode',
  'video',
  'person',
  'event',
  'channel',
  'collection',
  'comment',
] as const satisfies readonly DebateResourceKind[]

export type ResourceReferenceQualifier = '' | 'support' | 'oppose'

export interface ResourceReference {
  raw: string
  kind: DebateResourceKind
  id: string
  qualifier: ResourceReferenceQualifier
  from: number
  to: number
}

const resourceKindSet = new Set<string>(resourceKinds)
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const referencePattern = new RegExp(
  `@([a-z]+):(${uuidPattern})(?::([a-z]+))?`,
  'g',
)
const excludedMarkdownNodes = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'URL',
  'Autolink',
  'HTMLTag',
  'HTMLBlock',
  'LinkTitle',
  'CommentBlock',
  'ProcessingInstructionBlock',
])
const startBoundaryCharacter = /[\p{L}\p{N}_@-]/u
const endBoundaryCharacter = /[\p{L}\p{N}_-]/u

interface TextRange {
  from: number
  to: number
}

function collectExcludedRanges(content: string): TextRange[] {
  const ranges: TextRange[] = []
  commonmarkLanguage.parser.parse(content).iterate({
    enter(node) {
      if (!excludedMarkdownNodes.has(node.name)) return
      ranges.push({ from: node.from, to: node.to })
      return false
    },
  })
  return ranges
}

function previousCharacter(content: string, index: number) {
  if (index === 0) return ''
  const lastUnit = content.charCodeAt(index - 1)
  const start = lastUnit >= 0xDC00 && lastUnit <= 0xDFFF && index > 1
    ? index - 2
    : index - 1
  return content.slice(start, index)
}

function nextCharacter(content: string, index: number) {
  if (index >= content.length) return ''
  return String.fromCodePoint(content.codePointAt(index)!)
}

function hasValidBoundaries(content: string, from: number, to: number) {
  const before = previousCharacter(content, from)
  const after = nextCharacter(content, to)
  return (!before || !startBoundaryCharacter.test(before))
    && (!after || (after !== ':' && !endBoundaryCharacter.test(after)))
}

function overlapsExcludedRange(from: number, to: number, ranges: TextRange[]) {
  return ranges.some(range => from < range.to && to > range.from)
}

export function parseResourceReferences(content: string): ResourceReference[] {
  const references: ResourceReference[] = []
  const excludedRanges = collectExcludedRanges(content)

  for (const match of content.matchAll(referencePattern)) {
    const kind = match[1]
    const id = match[2]
    const qualifier = match[3] ?? ''
    if (!kind || !id || match.index === undefined || !resourceKindSet.has(kind)) continue
    const from = match.index
    const to = from + match[0].length
    if (!hasValidBoundaries(content, from, to) || overlapsExcludedRange(from, to, excludedRanges)) continue
    if (kind === 'debate') {
      if (qualifier !== 'support' && qualifier !== 'oppose') continue
    } else if (qualifier !== '') {
      continue
    }

    references.push({
      raw: match[0],
      kind: kind as DebateResourceKind,
      id,
      qualifier: qualifier as ResourceReferenceQualifier,
      from,
      to,
    })
  }

  return references
}

export function hasInvalidDebateReferenceSyntax(content: string) {
  const validReferences = new Set(
    parseResourceReferences(content)
      .filter(reference => reference.kind === 'debate')
      .map(reference => reference.raw),
  )
  const candidates = content.match(/@[a-z]+:[^\s`<>]+/gi) ?? []
  return candidates.some(candidate => !validReferences.has(candidate))
}
