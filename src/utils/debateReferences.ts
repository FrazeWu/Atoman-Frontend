import type { ContentReference, DebateReference, DebateReferenceRelation, LegacyDebateReference } from '@/types'

function isContentReference(reference: DebateReference): reference is ContentReference {
  return 'target' in reference
}

function legacyRelation(reference: LegacyDebateReference): DebateReferenceRelation | undefined {
  if (reference.kind !== 'debate' || !reference.qualifier) return undefined
  return {
    id: reference.relation_id ?? `${reference.resource_id}:${reference.qualifier}`,
    stance: reference.qualifier,
    state: reference.state,
  }
}

export function normalizeDebateReferences(references: readonly DebateReference[] = []): ContentReference[] {
  return references.map((reference, index) => {
    if (isContentReference(reference)) return reference
    return {
      id: reference.relation_id ?? `legacy-reference-${index}`,
      field: 'content',
      start: -1,
      end: -1,
      raw: reference.raw,
      target: {
        type: reference.kind,
        id: reference.resource_id,
        label: reference.title,
        available: reference.state !== 'unavailable',
      },
      relation: legacyRelation(reference),
    }
  })
}
