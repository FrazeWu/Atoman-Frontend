import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchCatalogWork } from '../api/bookApi'
import { bookKeys } from './bookKeys'

export function useCatalogWorkQuery(
  id: MaybeRefOrGetter<string | number | undefined | null>,
  options?: { queryClient?: QueryClient },
) {
  return useQuery(
    {
      queryKey: computed(() => bookKeys.catalogWork(toValue(id) || '')),
      queryFn: () => fetchCatalogWork(String(toValue(id))),
      staleTime: 5 * 60 * 1000,
      enabled: computed(() => Boolean(toValue(id))),
    },
    options?.queryClient,
  )
}
