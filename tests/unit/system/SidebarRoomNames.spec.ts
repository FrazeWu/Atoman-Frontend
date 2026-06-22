import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleRooms } from '@/config/moduleRooms'

const files = {
  media: '../../../src/views/media/MediaLayout.vue',
} as const

const oldLabels = {
  media: 'Studio',
} as const

describe('module sidebars room names', () => {
  it('renders sidebar room names and helper text from config', () => {
    for (const [key, filePath] of Object.entries(files)) {
      const source = readFileSync(resolve(__dirname, filePath), 'utf8')
      expect(source).toContain("import { moduleRooms } from '@/config/moduleRooms'")
      expect(source).toContain(`moduleRooms.${key}.name`)
      expect(source).toContain(`moduleRooms.${key}.helper`)
      expect(source).not.toContain(oldLabels[key as keyof typeof oldLabels])
      expect(moduleRooms[key as keyof typeof moduleRooms].name.length).toBe(2)
    }
  })
})
