import type { User } from '@/types'

export function isAdminRole(role?: User['role']) {
  return role === 'admin' || role === 'owner'
}

export function isModeratorRole(role?: User['role']) {
  return role === 'moderator' || isAdminRole(role)
}

export function isOwnerRole(role?: User['role']) {
  return role === 'owner'
}
