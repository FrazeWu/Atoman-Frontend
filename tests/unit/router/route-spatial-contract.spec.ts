import { describe, it, expect } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildAppRoutes } from '@/router/buildAppRoutes'
import { moduleRoutes } from '@/router/routes/modules'

const root = resolve(__dirname, '../../..')

function extractStaticToPaths(dir: string): string[] {
  const paths: string[] = []
  const entries = readdirSync(resolve(root, dir))
  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`
    const absPath = resolve(root, fullPath)
    if (statSync(absPath).isDirectory()) {
      paths.push(...extractStaticToPaths(fullPath))
    } else if (/\.(?:vue|ts)$/.test(entry)) {
      const content = readFileSync(absPath, 'utf8')
      const matches = content.matchAll(/\bto=["'](\/[a-zA-Z0-9_\-\/?#=]+)["']/g)
      for (const m of matches) {
        if (m[1]) paths.push(m[1])
      }
    }
  }
  return paths
}

describe('route-spatial-contract', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: buildAppRoutes(),
  })

  it('enforces relative paths for all module children routes without redundant module prefixes', () => {
    for (const [moduleKey, routes] of Object.entries(moduleRoutes)) {
      for (const route of routes) {
        if (!route.children) continue
        for (const child of route.children) {
          expect(child.path.startsWith('/')).toBe(false)
          expect(child.path).not.toMatch(new RegExp(`^${moduleKey}(/|$)`))
          expect(child.path).not.toMatch(/^blog(\/|$)/)
        }
      }
    }
  })

  it('redirects /blog and its subroutes to /posts', async () => {
    await router.push('/blog')
    expect(router.currentRoute.value.path).toBe('/posts')

    await router.push('/blog/articles')
    expect(router.currentRoute.value.path).toBe('/posts/articles')
  })

  it('redirects /studio/blog/editor to /studio/blog/new', async () => {
    await router.push('/studio/blog/editor')
    expect(router.currentRoute.value.path).toBe('/studio/blog/new')
  })

  it('redirects /modules to / on desktop', async () => {
    await router.push('/modules')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('ensures all static root-relative to="..." links resolve to valid routes without 404', () => {
    const staticPaths = Array.from(new Set(extractStaticToPaths('src')))
    expect(staticPaths.length).toBeGreaterThan(15)

    for (const target of staticPaths) {
      const resolved = router.resolve(target)
      expect(resolved.matched.length).toBeGreaterThan(0)
      const last = resolved.matched[resolved.matched.length - 1]
      expect(last.path).not.toBe('/:pathMatch(.*)*')
      expect(last.path).not.toBe('/__not_found__')
    }
  })
})
