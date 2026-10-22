import type { RouteRecordRaw } from 'vue-router'
import { unifiedSearchEnabled, readSearchQuery, writeSearchQuery } from '@/utils/searchUrl'

export function withUnifiedSearch(routes: RouteRecordRaw[], module: string): RouteRecordRaw[] {
  return routes.map(route => {
    if (unifiedSearchEnabled && route.path === 'search') {
      return { path: route.path, redirect: to => {
        const state = readSearchQuery(to.query)
        const aliases: Record<string, string> = { works: 'work', people: module === 'books' ? 'author' : 'person', lists: 'book_list', thread: 'topic' }
        state.module = module
        state.types = state.types.map(type => aliases[type] || type)
        return { path: '/search', query: writeSearchQuery(state), hash: to.hash }
      } }
    }
    return { ...route, ...(route.children ? { children: withUnifiedSearch(route.children, module) } : {}) } as RouteRecordRaw
  })
}
