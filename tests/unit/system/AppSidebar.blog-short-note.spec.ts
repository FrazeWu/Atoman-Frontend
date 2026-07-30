import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'

const source = readFileSync(resolve(process.cwd(), 'src/components/system/AppSidebar.vue'), 'utf8')

describe('AppSidebar blog navigation', () => {
  it('provides a short-note entry that opens the studio post editor', async () => {
    expect(source).toContain("{ to: '/studio/blog/new', label: '写短话', icon: PenLine }")

    const router = createRouter({ history: createMemoryHistory(), routes: buildAppRoutes() })
    await router.push('/studio/blog/new')
    expect(router.currentRoute.value.name).toBe('studio-blog-new')
  })
})
