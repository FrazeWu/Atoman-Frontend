import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { buildAppRoutes } from '@/router/buildAppRoutes'

const source = readFileSync(resolve(process.cwd(), 'src/components/system/AppSidebar.vue'), 'utf8')

describe('AppSidebar blog navigation', () => {
  it('keeps only the short-note timeline entry', async () => {
    expect(source).not.toContain("label: '写短话'")
    expect(source).toContain("{ to: '/posts/notes', label: '短话', icon: MessageSquare }")

    const router = createRouter({ history: createMemoryHistory(), routes: buildAppRoutes() })
    await router.push('/posts/notes')
    expect(router.currentRoute.value.fullPath).toBe('/posts/notes')
  })
})
