import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/composables/useMediaChannel.ts'), 'utf8')

describe('useMediaChannel source', () => {
  it('uses shared api client helpers instead of direct fetch', () => {
    expect(source).toContain("from '@/api/client'")
    expect(source).toContain('apiGetRaw<Channel[] | { data?: Channel[] }>')
    expect(source).not.toContain('await fetch(')
  })
})
