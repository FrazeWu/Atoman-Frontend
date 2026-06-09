import path from 'node:path'
import { readFileSync } from 'node:fs'

const nginxSource = readFileSync(
  path.resolve(process.cwd(), '../nginx/conf.d/default.conf'),
  'utf8',
)

describe('production nginx cache control', () => {
  it('keeps SPA html revalidated while preserving immutable asset caching', () => {
    expect(nginxSource).toContain('location = /index.html')
    expect(nginxSource).toContain('Cache-Control "no-cache, no-store, must-revalidate"')
    expect(nginxSource).toContain('Pragma "no-cache"')
    expect(nginxSource).toContain('Expires "0"')
    expect(nginxSource).toContain('Cache-Control "public, immutable"')
  })
})