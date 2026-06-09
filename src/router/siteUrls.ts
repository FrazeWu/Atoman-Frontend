import type { ModuleRoomKey } from '@/config/moduleRooms'
import { isLocalHost } from './siteContext'

function currentProtocol() {
  return typeof window === 'undefined' ? 'https:' : window.location.protocol
}

function currentHostname() {
  return typeof window === 'undefined' ? 'localhost' : window.location.hostname
}

function baseDomain(hostname: string) {
  const parts = hostname.split('.')
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname
}

function siteUrl(label: string, protocol: string, hostname: string) {
  if (isLocalHost(hostname)) return `/?site=${label}`
  return `${protocol}//${baseDomain(hostname)}/?site=${label}`
}

export function moduleUrl(
  module: ModuleRoomKey,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  return siteUrl(module, protocol, hostname)
}

export function modulePathUrl(
  module: ModuleRoomKey,
  path: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = isLocalHost(hostname) ? `${protocol}//${hostname}/?site=${module}` : siteUrl(module, protocol, hostname)
  const url = new URL(base)
  url.pathname = normalizedPath

  if (isLocalHost(hostname)) {
    return `${url.pathname}${url.search}`
  }

  return url.toString()
}

export function userUrl(
  username: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  return siteUrl(`u-${username}`, protocol, hostname)
}

export function channelUrl(
  slug: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  return siteUrl(`c-${slug}`, protocol, hostname)
}
