import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchSongDetail } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useSongDetailQuery(id: MaybeRefOrGetter<string | number | undefined | null>) {
  return useQuery({
    queryKey: computed(() => musicKeys.songDetail(toValue(id) ?? '')),
    queryFn: () => {
      const resolvedId = toValue(id)
      if (!resolvedId) throw new Error('Song ID is required')
      return fetchSongDetail(resolvedId)
    },
    staleTime: 5 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
