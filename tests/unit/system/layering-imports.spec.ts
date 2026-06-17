import path from 'node:path'
import { readFileSync, readdirSync, statSync } from 'node:fs'

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, acc)
    else if (full.endsWith('.vue') || full.endsWith('.ts')) acc.push(full)
  }
  return acc
}

describe('frontend layering import boundaries', () => {
  it('prevents components from importing view files', () => {
    const componentFiles = walk(path.resolve(process.cwd(), 'src/components'))

    for (const file of componentFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/from ['"]@\/views\//)
      expect(source).not.toMatch(/from ['"].*\/views\//)
    }
  })

  it('keeps route-level pages under src/views', () => {
    const viewFiles = walk(path.resolve(process.cwd(), 'src/views'))
    expect(viewFiles.length).toBeGreaterThan(0)
  })
})
