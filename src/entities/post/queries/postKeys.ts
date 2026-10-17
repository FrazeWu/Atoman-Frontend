import type { PostListFilter } from '../model/types'

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters?: PostListFilter) => [...postKeys.lists(), filters ?? {}] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (idOrSlug: string | number) => [...postKeys.details(), String(idOrSlug)] as const,
}
