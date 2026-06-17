import { readFileSync } from 'node:fs'
import path from 'node:path'

const packageJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
) as { scripts: Record<string, string> }

describe('vite mode scripts', () => {
  it('loads the dev env file when running the dev server', () => {
    expect(packageJson.scripts.dev).toContain('--mode dev')
  })

  it('loads the prod env file when building for production', () => {
    expect(packageJson.scripts.build).toContain('--mode prod')
  })
})
