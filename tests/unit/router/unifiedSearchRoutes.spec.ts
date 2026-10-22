import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { withUnifiedSearch } from '@/router/unifiedSearchRoutes'

vi.mock('@/utils/searchUrl', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/searchUrl')>(), unifiedSearchEnabled: true,
}))
describe('开启统一入口后的旧路由兼容', () => {
  it.each(['books', 'forum', 'video', 'debate', 'timeline', 'music'])('转换 %s 模块搜索且保留重复参数', async module => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      ...withUnifiedSearch([{ path: `/${module}`, children: [{ path: 'search', component: { template: '<div />' } }] }], module),
      { path: '/search', component: { template: '<div />' } },
    ] })
    await router.push(`/${module}/search?q=科幻&type=work&filter[language]=zh&filter[language]=en&page=2`)
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: '科幻', module, type: ['work'], 'filter[language]': ['zh', 'en'], page: '2' })
  })
  it('转换旧图书作者类型', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      ...withUnifiedSearch([{ path: '/books', children: [{ path: 'search', component: { template: '<div />' } }] }], 'books'),
      { path: '/search', component: { template: '<div />' } },
    ] })
    await router.push('/books/search?q=刘慈欣&type=people')
    expect(router.currentRoute.value.query.type).toEqual(['author'])
  })
})
