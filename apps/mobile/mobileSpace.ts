import { SPACE_TABS } from './components/system/bottomNavConstants'

export type MobileSpace = keyof typeof SPACE_TABS

const spaceRoutes: Array<[RegExp, MobileSpace]> = [
  [/^\/music(?:\/|$)/, 'music'],
  [/^\/feed(?:\/|$)/, 'feed'],
  [/^\/books(?:\/|$)/, 'books'],
  [/^\/(?:posts|post|channel|channels|collection|users)(?:\/|$)/, 'blog'],
  [/^\/debate(?:\/|$)/, 'debate'],
  [/^\/(?:inbox|messages|notifications)(?:\/|$)/, 'messages'],
  [/^\/studio(?:\/|$)/, 'studio'],
  [/^\/podcasts(?:\/|$)/, 'podcast'],
  [/^\/videos(?:\/|$)/, 'video'],
  [/^\/forum(?:\/|$)/, 'forum'],
  [/^\/timeline(?:\/|$)/, 'timeline'],
]

/** Unknown routes must never silently inherit the music navigation. */
export function resolveMobileSpace(path: string, searchModule?: unknown, previousSpace: MobileSpace = 'global'): MobileSpace {
  const normalized = path.split(/[?#]/, 1)[0] || '/'
  if (/^\/users\/[^/]+\/settings(?:\/|$)/.test(normalized)) return 'global'
  if (normalized === '/search') {
    return typeof searchModule === 'string' && Object.prototype.hasOwnProperty.call(SPACE_TABS, searchModule)
      ? searchModule : 'global'
  }
  if (normalized === '/me') return previousSpace
  const match = spaceRoutes.find(([pattern]) => pattern.test(normalized))
  return match?.[1] || 'global'
}
