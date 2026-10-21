import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchPlaylistDetail } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function usePlaylistDetailQuery(id: MaybeRefOrGetter<string | number | undefined | null>) {
  return useQuery({
    queryKey: computed(() => musicKeys.playlistDetail(toValue(id) ?? '')),
    queryFn: () => {
      const resolvedId = toValue(id)
      if (!resolvedId) throw new Error('Playlist ID is required')
      return fetchPlaylistDetail(resolvedId)
    },
    staleTime: 5 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
