import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const llmsPath = resolve(process.cwd(), 'public/llms.txt')

describe('llms.txt', () => {
  it('publishes a headed Markdown guide with public site links', () => {
    expect(existsSync(llmsPath)).toBe(true)

    const content = existsSync(llmsPath) ? readFileSync(llmsPath, 'utf8') : ''

    expect(content).toMatch(/^#\s+Atoman\b/m)
    expect(content).toContain('https://www.atoman.org/')
    expect(content).toMatch(/\[[^\]]+\]\(https:\/\/www\.atoman\.org\/[^)]+\)/)
    expect(content).toContain('https://www.atoman.org/posts')
    expect(content).toContain('https://www.atoman.org/music')
  })
})
