import { referenceApi, type ReferenceResourceType, type ReferenceTarget } from '@/api/references'

export const referenceResourceTypes: Array<{ type: ReferenceResourceType; label: string }> = [
  { type: 'post', label: '文章' },
  { type: 'thread', label: '论坛主题' },
  { type: 'debate', label: '辩题' },
  { type: 'feed', label: '订阅源' },
  { type: 'article', label: '订阅文章' },
  { type: 'artist', label: '艺术家' },
  { type: 'album', label: '专辑' },
  { type: 'song', label: '歌曲' },
  { type: 'playlist', label: '歌单' },
  { type: 'podcast', label: '播客' },
  { type: 'episode', label: '单集' },
  { type: 'video', label: '视频' },
  { type: 'person', label: '人物' },
  { type: 'event', label: '事件' },
  { type: 'channel', label: '频道' },
  { type: 'collection', label: '合集' },
  { type: 'comment', label: '评论' },
]

export type ReferenceTrigger =
  | { mode: 'root'; query: string; start: number }
  | { mode: 'resource'; targetType: ReferenceResourceType; query: string; start: number }

export type ReferenceSuggestion =
  | ({ kind: 'target'; key: string; targetType: 'user' | ReferenceResourceType; qualifier?: 'support' | 'oppose' } & Omit<ReferenceTarget, 'type'>)
  | { kind: 'type'; key: string; targetType: ReferenceResourceType; label: string }

const supportedTypeSet = new Set(referenceResourceTypes.map(({ type }) => type))

export function insertReferenceTrigger(value: string, start: number, end: number) {
  const preceding = start > 0 ? value[start - 1] : ''
  const insert = preceding && /[\p{L}\p{N}_]/u.test(preceding) ? ' @' : '@'
  return {
    value: `${value.slice(0, start)}${insert}${value.slice(end)}`,
    cursor: start + insert.length,
    insert,
  }
}

export function referencePublishErrorMessage(error: unknown, fallback: string) {
  let payload = error
  if (payload && typeof payload === 'object' && 'error' in payload) {
    payload = (payload as { error?: unknown }).error
  }
  const code = payload && typeof payload === 'object' && 'code' in payload
    ? (payload as { code?: unknown }).code
    : undefined
  return code === 'reference.invalid_syntax' || code === 'reference.invalid_target'
    ? '请从候选中选择有效引用'
    : fallback
}

export function fitReferenceMenuPosition(
  anchor: { left: number; top: number; bottom: number },
  viewport: { width: number; height: number },
) {
  const padding = 12
  const gap = 4
  const menuWidth = Math.min(384, Math.max(0, viewport.width - padding * 2))
  const menuHeight = 288
  const maxLeft = Math.max(padding, viewport.width - padding - menuWidth)
  const left = Math.min(Math.max(anchor.left, padding), maxLeft)
  const below = anchor.bottom + gap
  const top = below + menuHeight <= viewport.height - padding
    ? below
    : Math.max(padding, anchor.top - gap - menuHeight)
  return { left, top }
}

function isExcludedMarkdownContext(textBefore: string, at: number) {
  const prefix = textBefore.slice(0, at)
  const backticks = prefix.match(/(?<!\\)`/g)?.length ?? 0
  if (backticks % 2 === 1) return true
  return prefix.lastIndexOf('](') > prefix.lastIndexOf(')')
}

export function parseReferenceTrigger(textBefore: string): ReferenceTrigger | null {
  const at = textBefore.lastIndexOf('@')
  if (at < 0 || isExcludedMarkdownContext(textBefore, at)) return null
  const preceding = at > 0 ? textBefore[at - 1] : ''
  if (preceding && /[\p{L}\p{N}_]/u.test(preceding)) return null
  const token = textBefore.slice(at)
  if (/^@debate:[0-9a-f-]{36}:(?:support|oppose)$/i.test(token)) return null

  const resource = token.match(/^@([a-z]+):([^:\r\n]*)$/)
  if (resource) {
    const targetType = resource[1] as ReferenceResourceType
    if (!supportedTypeSet.has(targetType)) return null
    return { mode: 'resource', targetType, query: resource[2], start: at }
  }
  const root = token.match(/^@([\p{L}\p{N}_.-]*)$/u)
  if (!root) return null
  return { mode: 'root', query: root[1], start: at }
}

function targetSuggestion(target: ReferenceTarget): ReferenceSuggestion {
  return {
    kind: 'target', key: `${target.type}:${target.id}`, targetType: target.type,
    id: target.id, label: target.label, subtitle: target.subtitle,
    module: target.module, path: target.path, available: target.available,
  }
}

export async function searchReferenceSuggestions(trigger: ReferenceTrigger, limit = 10): Promise<ReferenceSuggestion[]> {
  if (trigger.mode === 'resource') {
    return (await referenceApi.search(trigger.targetType, trigger.query, limit)).map(targetSuggestion)
  }
  const normalized = trigger.query.toLocaleLowerCase()
  const types: ReferenceSuggestion[] = referenceResourceTypes
    .filter(({ type, label }) => !normalized || type.startsWith(normalized) || label.includes(trigger.query))
    .map(({ type, label }) => ({ kind: 'type', key: `type:${type}`, targetType: type, label }))
  let users: ReferenceSuggestion[] = []
  try {
    users = (await referenceApi.search('user', trigger.query, Math.min(5, limit))).map(targetSuggestion)
  } catch {
    users = []
  }
  return [...users, ...types].slice(0, limit)
}

export async function searchDebateReferenceSuggestions(
  trigger: ReferenceTrigger,
  limit = 10,
): Promise<ReferenceSuggestion[]> {
  if (trigger.mode === 'resource' && trigger.targetType !== 'debate') return []
  const targets = await referenceApi.search('debate', trigger.query, limit)
  return targets
    .filter(target => target.available)
    .flatMap((target) => {
      const suggestion = targetSuggestion(target)
      return (['support', 'oppose'] as const).map(qualifier => ({
        ...suggestion,
        key: `${suggestion.key}:${qualifier}`,
        qualifier,
      }))
    })
}

export function referenceTokenForSuggestion(suggestion: ReferenceSuggestion) {
  if (suggestion.kind === 'type') return `@${suggestion.targetType}:`
  if (suggestion.targetType === 'user') return suggestion.subtitle?.startsWith('@') ? suggestion.subtitle : `@${suggestion.label}`
  const qualifier = suggestion.qualifier ? `:${suggestion.qualifier}` : ''
  return `@${suggestion.targetType}:${suggestion.id}${qualifier}`
}
