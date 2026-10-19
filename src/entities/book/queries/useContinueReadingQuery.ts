import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchContinueReading } from '../api/bookApi'
import { bookKeys } from './bookKeys'

export function useContinueReadingQuery(
  limit: MaybeRefOrGetter<number> = 20,
  options?: { queryClient?: QueryClient },
) {
  return useQuery(
    {
      queryKey: computed(() => bookKeys.continueReading()),
      queryFn: () => fetchContinueReading(toValue(limit)),
      staleTime: 1 * 60 * 1000,
    },
    options?.queryClient,
  )
}
