import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
    } else if (entry.endsWith('.vue') || entry.endsWith('.ts')) {
      if (!entry.endsWith('.d.ts')) {
        files.push(fullPath)
      }
    }
  }

  return files
}

describe('Native Dialog Zero Tolerance Contract', () => {
  it('forbids window.alert across production source code', () => {
    const root = resolve(process.cwd())
    const srcFiles = [
      ...collectSourceFiles(join(root, 'src')),
      ...collectSourceFiles(join(root, 'apps/mobile')),
    ]

    const violations: Array<{ file: string; line: number; text: string }> = []

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8')
      const lines = content.split('\n')

      lines.forEach((lineText, idx) => {
        if (lineText.includes('window.alert')) {
          violations.push({
            file: file.replace(root + '/', ''),
            line: idx + 1,
            text: lineText.trim(),
          })
        }
      })
    }

    expect(
      violations,
      `Found forbidden window.alert calls:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([])
  })

  it('forbids window.confirm across production source code', () => {
    const root = resolve(process.cwd())
    const srcFiles = [
      ...collectSourceFiles(join(root, 'src')),
      ...collectSourceFiles(join(root, 'apps/mobile')),
    ]

    const violations: Array<{ file: string; line: number; text: string }> = []

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8')
      const lines = content.split('\n')

      lines.forEach((lineText, idx) => {
        if (lineText.includes('window.confirm')) {
          violations.push({
            file: file.replace(root + '/', ''),
            line: idx + 1,
            text: lineText.trim(),
          })
        }
      })
    }

    expect(
      violations,
      `Found forbidden window.confirm calls:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([])
  })
})
