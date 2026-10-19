import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchAlbumById } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useAlbumQuery(id: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.album(toValue(id))),
    queryFn: () => fetchAlbumById(toValue(id)),
    staleTime: 10 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
