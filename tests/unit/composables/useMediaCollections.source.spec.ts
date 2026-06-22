import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/composables/useMediaCollections.ts'), 'utf8')

describe('useMediaCollections source', () => {
  it('uses shared raw get helper instead of direct fetch', () => {
    expect(source).toContain("from '@/api/client'")
    expect(source).toContain('apiGetRaw<Collection[] | { data?: Collection[] }>')
    expect(source).not.toContain('await fetch(')
  })
})
