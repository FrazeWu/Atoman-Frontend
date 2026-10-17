import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchPostList } from '../api/postApi'
import { postKeys } from './postKeys'
import type { PostListFilter } from '../model/types'

export function usePostListQuery(filters?: MaybeRefOrGetter<PostListFilter | undefined>) {
  return useQuery({
    queryKey: computed(() => postKeys.list(toValue(filters))),
    queryFn: () => fetchPostList(toValue(filters)),
    staleTime: 1000 * 60 * 2,
  })
}
