import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchBookNotes } from '../api/bookApi'
import { bookKeys } from './bookKeys'
import type { ListBookNotesQuery } from '../model/types'

export function useBookNotesQuery(
  query?: MaybeRefOrGetter<ListBookNotesQuery | undefined>,
  options?: { queryClient?: QueryClient },
) {
  return useQuery(
    {
      queryKey: computed(() => bookKeys.notesList(toValue(query) as Record<string, unknown> | undefined)),
      queryFn: () => fetchBookNotes(toValue(query)),
      staleTime: 2 * 60 * 1000,
    },
    options?.queryClient,
  )
}
