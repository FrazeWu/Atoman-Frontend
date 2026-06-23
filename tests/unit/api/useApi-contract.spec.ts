import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { globSync } from 'glob'
import { useApi, useApiUrl } from '../../../src/composables/useApi'

const projectRoot = process.cwd()
const allowedApiFiles = new Set([
  'src/composables/useApi.ts',
  'src/api/client.ts',
  'src/api/musicV1.ts',
])

describe('API endpoint construction contract', () => {
  it('defaults API requests to the versioned backend prefix', () => {
    expect(useApiUrl()).toBe('/api/v1')
  })

  it('normalizes configured API roots to the versioned backend prefix', () => {
    const env = import.meta.env as ImportMetaEnv

    env.VITE_API_URL = '/api'
    expect(useApiUrl()).toBe('/api/v1')

    env.VITE_API_URL = '/api/v1'
    expect(useApiUrl()).toBe('/api/v1')

    env.VITE_API_URL = 'http://localhost:8080'
    expect(useApiUrl()).toBe('http://localhost:8080/api/v1')

    env.VITE_API_URL = 'http://localhost:8080/api'
    expect(useApiUrl()).toBe('http://localhost:8080/api/v1')

    env.VITE_API_URL = undefined as unknown as string
  })

  it('derives v1 endpoint groups from the configured versioned base URL', () => {
    const env = import.meta.env as ImportMetaEnv

    env.VITE_API_URL = 'http://localhost:8080/api'
    const api = useApi()

    expect(api.v1.url).toBe('http://localhost:8080/api/v1')
    expect(api.v1.uploads).toBe('http://localhost:8080/api/v1/uploads')
    expect(api.v1.music.albums).toBe('http://localhost:8080/api/v1/music/albums')
    expect(api.v1.forum.categories).toBe('http://localhost:8080/api/v1/forum/categories')
    expect(api.admin.feed.opmlImport).toBe('http://localhost:8080/api/v1/feed/sources/opml/import')
    expect(api.admin.feed.opmlExport).toBe('http://localhost:8080/api/v1/feed/sources/opml/export')

    env.VITE_API_URL = undefined as unknown as string
  })

  it('does not expose legacy top-level music CRUD endpoints', () => {
    const api = useApi()

    expect(api).not.toHaveProperty('songs')
    expect(api).not.toHaveProperty('song')
    expect(api).not.toHaveProperty('albums')
    expect(api).not.toHaveProperty('album')
    expect(api).not.toHaveProperty('artists')
    expect(api).not.toHaveProperty('corrections')
    expect(api).not.toHaveProperty('music.albums')
    expect(api).not.toHaveProperty('music.album')
    expect(api).not.toHaveProperty('music.artists')
    expect(api).not.toHaveProperty('music.artistRevisions')
    expect(api).not.toHaveProperty('music.artistAliases')
    expect(api).not.toHaveProperty('music.songAnnotations')
  })

  it('keeps VITE_API_URL access centralized in useApi helpers', () => {
    const offenders = globSync('src/**/*.{ts,vue}', { cwd: projectRoot })
      .filter((file) => !allowedApiFiles.has(file))
      .filter((file) => readFileSync(join(projectRoot, file), 'utf8').includes('import.meta.env.VITE_API_URL'))

    expect(offenders).toEqual([])
  })

  it('uses useApi for hardcoded API fetch paths outside API helpers', () => {
    const offenders = globSync('src/**/*.{ts,vue}', { cwd: projectRoot })
      .filter((file) => !allowedApiFiles.has(file))
      .flatMap((file) => {
        const source = readFileSync(join(projectRoot, file), 'utf8')
        return source
          .split('\n')
          .map((line, index) => ({ file: relative(projectRoot, join(projectRoot, file)), line, lineNumber: index + 1 }))
          .filter(({ line }) => /fetch\(\s*[`'"]\/api\//.test(line))
          .map(({ file, lineNumber }) => `${file}:${lineNumber}`)
      })

    expect(offenders).toEqual([])
  })
})
