import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchBookShelf } from '../api/bookApi'
import { bookKeys } from './bookKeys'

export function useBookShelfQuery(
  status?: MaybeRefOrGetter<string | undefined | null>,
  pagination?: { limit?: number; offset?: number },
  options?: { queryClient?: QueryClient },
) {
  const limit = pagination?.limit ?? 100
  const offset = pagination?.offset ?? 0
  return useQuery(
    {
      queryKey: computed(() => bookKeys.shelfList(toValue(status) || '')),
      queryFn: () => fetchBookShelf(toValue(status) || '', limit, offset),
      staleTime: 2 * 60 * 1000,
    },
    options?.queryClient,
  )
}
