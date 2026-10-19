import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchArtistDetail } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useArtistDetailQuery(id: MaybeRefOrGetter<string | number | undefined | null>) {
  return useQuery({
    queryKey: computed(() => musicKeys.artistDetail(toValue(id) ?? '')),
    queryFn: () => {
      const resolvedId = toValue(id)
      if (!resolvedId) throw new Error('Artist ID is required')
      return fetchArtistDetail(resolvedId)
    },
    staleTime: 5 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
