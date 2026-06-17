import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'

export type SiteContext =
  | { type: 'portal' }
  | { type: 'module'; module: ModuleRoomKey }
  | { type: 'entity'; handle: string; legacyType?: 'user' | 'channel' }
  | { type: 'unknown'; subdomain: string }

export const moduleSubdomains = Object.keys(moduleRooms) as ModuleRoomKey[]

const slugPattern = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/

function contextFromLabel(label: string): SiteContext {
  if (moduleSubdomains.includes(label as ModuleRoomKey)) {
    return { type: 'module', module: label as ModuleRoomKey }
  }

  if (label.startsWith('u-')) {
    const handle = label.slice(2)
    return slugPattern.test(handle)
      ? { type: 'entity', handle, legacyType: 'user' }
      : { type: 'unknown', subdomain: label }
  }

  if (label.startsWith('c-')) {
    const handle = label.slice(2)
    return slugPattern.test(handle)
      ? { type: 'entity', handle, legacyType: 'channel' }
      : { type: 'unknown', subdomain: label }
  }

  if (slugPattern.test(label)) {
    return { type: 'entity', handle: label }
  }

  return { type: 'unknown', subdomain: label }
}

function localDevContext(search: string): SiteContext | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const site = params.get('site')
  if (!site) return null
  return contextFromLabel(site)
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

export function resolveSiteContext(hostname: string, search = ''): SiteContext {
  const explicitContext = localDevContext(search)
  if (explicitContext) return explicitContext

  if (isLocalHost(hostname)) {
    return { type: 'module', module: 'feed' }
  }

  if (isIPv4Host(hostname)) {
    return { type: 'unknown', subdomain: hostname.split('.')[0] }
  }

  const parts = hostname.split('.')
  // If base domain or www, and no ?site= was found
  if (parts.length <= 2 || parts[0] === 'www') {
    // Default to feed module on the base domain if no context is provided
    return { type: 'module', module: 'feed' }
  }

  // Otherwise, use the subdomain
  return contextFromLabel(parts[0])
}
