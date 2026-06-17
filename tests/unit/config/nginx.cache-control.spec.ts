import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const nginxPath = path.resolve(process.cwd(), '../nginx/conf.d/default.conf')
const describeIfNginxExists = existsSync(nginxPath) ? describe : describe.skip

describeIfNginxExists('production nginx cache control', () => {
  it('keeps SPA html revalidated while preserving immutable asset caching', () => {
    const nginxSource = readFileSync(nginxPath, 'utf8')

    expect(nginxSource).toContain('location = /index.html')
    expect(nginxSource).toContain('Cache-Control "no-cache, no-store, must-revalidate"')
    expect(nginxSource).toContain('Pragma "no-cache"')
    expect(nginxSource).toContain('Expires "0"')
    expect(nginxSource).toContain('Cache-Control "public, immutable"')
  })
})