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
  `@([a-z]+):(${uuidPattern})(?::([a-z]+))?(?![:0-9A-Za-z_-])`,
  'g',
)

export function parseResourceReferences(content: string): ResourceReference[] {
  const references: ResourceReference[] = []

  for (const match of content.matchAll(referencePattern)) {
    const kind = match[1]
    const id = match[2]
    const qualifier = match[3] ?? ''
    if (!kind || !id || match.index === undefined || !resourceKindSet.has(kind)) continue
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
      from: match.index,
      to: match.index + match[0].length,
    })
  }

  return references
}
