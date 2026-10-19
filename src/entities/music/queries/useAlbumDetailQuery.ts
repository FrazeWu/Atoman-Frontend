import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchAlbumDetail } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useAlbumDetailQuery(id: MaybeRefOrGetter<string | number | undefined | null>) {
  return useQuery({
    queryKey: computed(() => musicKeys.albumDetail(toValue(id) ?? '')),
    queryFn: () => {
      const resolvedId = toValue(id)
      if (!resolvedId) throw new Error('Album ID is required')
      return fetchAlbumDetail(resolvedId)
    },
    staleTime: 5 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
