import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { getPostById } from '../api/postApi'
import { postKeys } from './postKeys'

export function usePostQuery(idOrSlug: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => postKeys.detail(toValue(idOrSlug))),
    queryFn: () => getPostById(toValue(idOrSlug)),
    staleTime: 1000 * 60 * 5,
    enabled: computed(() => Boolean(toValue(idOrSlug))),
  })
}
