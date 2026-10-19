import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchSongById } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useSongQuery(id: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.song(toValue(id))),
    queryFn: () => fetchSongById(toValue(id)),
    staleTime: 5 * 60 * 1000,
    enabled: computed(() => Boolean(toValue(id))),
  })
}
