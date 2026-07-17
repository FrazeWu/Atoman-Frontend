import { readFileSync } from 'node:fs'
import path from 'node:path'

const packageJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
) as { scripts: Record<string, string> }

describe('vite mode scripts', () => {
  it('loads the dev env file when running the dev server', () => {
    expect(packageJson.scripts.dev).toContain('--mode development')
  })

  it('loads the prod env file when building for production', () => {
    expect(packageJson.scripts.build).toContain('--mode production')
  })

  it('keeps vite on a Cloudflare Pages compatible major version', () => {
    const viteVersion = packageJson.devDependencies?.vite
    const major = Number(String(viteVersion).replace(/^[^\d]*/, '').split('.')[0])
    expect(major).toBeGreaterThanOrEqual(6)
  })
})
