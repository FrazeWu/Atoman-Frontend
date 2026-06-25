import type { ModuleRoomKey } from '@/config/moduleRooms'
import { moduleRooms } from '@/config/moduleRooms'

function currentProtocol() {
  return typeof window === 'undefined' ? 'https:' : window.location.protocol
}

function currentHostname() {
  return typeof window === 'undefined' ? 'localhost' : window.location.hostname
}

export function modulePathUrl(
  module: ModuleRoomKey,
  path: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  void protocol
  void hostname
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const prefix = `/${moduleRooms[module].publicPathSegment}`
  return normalizedPath === '/' ? prefix : `${prefix}${normalizedPath}`
}

export function moduleUrl(
  module: ModuleRoomKey,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  return modulePathUrl(module, '/', protocol, hostname)
}

export function userUrl(
  username: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  void protocol
  void hostname
  return `/users/${username}`
}

export function channelUrl(
  slug: string,
  protocol = currentProtocol(),
  hostname = currentHostname(),
) {
  void protocol
  void hostname
  return `/channels/${slug}`
}
