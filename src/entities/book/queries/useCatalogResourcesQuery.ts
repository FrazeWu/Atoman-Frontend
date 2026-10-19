import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchCatalogResources } from '../api/bookApi'
import { bookKeys } from './bookKeys'

export function useCatalogResourcesQuery(
  workId: MaybeRefOrGetter<string | number | undefined | null>,
  options?: { queryClient?: QueryClient },
) {
  return useQuery(
    {
      queryKey: computed(() => bookKeys.catalogResources(toValue(workId) || '')),
      queryFn: () => fetchCatalogResources(String(toValue(workId))),
      staleTime: 5 * 60 * 1000,
      enabled: computed(() => Boolean(toValue(workId))),
    },
    options?.queryClient,
  )
}
