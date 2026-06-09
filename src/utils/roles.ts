import type { User } from '@/types'

export function isAdminRole(role?: User['role']) {
  return role === 'admin' || role === 'owner'
}

export function isOwnerRole(role?: User['role']) {
  return role === 'owner'
}
