import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchLyricsBySongId } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useLyricsQuery(songId: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.lyrics(toValue(songId))),
    queryFn: () => fetchLyricsBySongId(toValue(songId)),
    staleTime: Infinity,
    enabled: computed(() => Boolean(toValue(songId))),
  })
}
