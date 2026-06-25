import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'

export type SiteContext =
  | { type: 'portal' }
  | { type: 'module'; module: ModuleRoomKey }
  | { type: 'entity'; handle: string }
  | { type: 'unknown'; subdomain: string }

export const moduleSubdomains = Object.keys(moduleRooms) as ModuleRoomKey[]
const modulePathSegments = Object.fromEntries(
  moduleSubdomains.map((key) => [moduleRooms[key].publicPathSegment, key]),
) as Record<string, ModuleRoomKey>

const slugPattern = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/

function contextFromLabel(label: string): SiteContext {
  if (moduleSubdomains.includes(label as ModuleRoomKey)) {
    return { type: 'module', module: label as ModuleRoomKey }
  }

  if (label.startsWith('u-')) {
    const handle = label.slice(2)
    return slugPattern.test(handle)
      ? { type: 'entity', handle }
      : { type: 'unknown', subdomain: label }
  }

  if (label.startsWith('c-')) {
    const handle = label.slice(2)
    return slugPattern.test(handle)
      ? { type: 'entity', handle }
      : { type: 'unknown', subdomain: label }
  }

  if (slugPattern.test(label)) {
    return { type: 'entity', handle: label }
  }

  return { type: 'unknown', subdomain: label }
}

function pathnameContext(pathname: string): SiteContext | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return { type: 'module', module: 'feed' }
  }

  const [first, second] = segments
  const moduleFromPath = modulePathSegments[first]
  if (moduleFromPath) {
    return { type: 'module', module: moduleFromPath }
  }

  if ((first === 'users' || first === 'channels') && second) {
    if (slugPattern.test(second)) {
      return { type: 'entity', handle: second }
    }
    return { type: 'unknown', subdomain: second }
  }

  return null
}

export function isLocalHost(hostname: string) {
  return (
    hostname === 'localhost'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
  )
}

function isIPv4Host(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
}

export function resolveSiteContext(hostname: string, search = '', pathname?: string): SiteContext {
  if (typeof pathname === 'string') {
    const pathContext = pathnameContext(pathname)
    if (pathContext) return pathContext
  }

  if (isLocalHost(hostname) || isIPv4Host(hostname)) {
    return { type: 'module', module: 'feed' }
  }
  void search
  void contextFromLabel
  return { type: 'module', module: 'feed' }
}
