import path from 'node:path'
import { readFileSync } from 'node:fs'

const publicEditorViews = [
  'src/views/forum/ForumTopicView.vue',
  'src/views/debate/DebateTopicView.vue',
] as const

describe('public discussion editor loading', () => {
  it('keeps AEditor behind async component boundaries on public discussion pages', () => {
    for (const relativePath of publicEditorViews) {
      const source = readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

      expect(source, relativePath).not.toContain("import AEditor from '@/components/shared/AEditor.vue'")
      expect(source, relativePath).toContain("defineAsyncComponent(() => import('@/components/shared/AEditor.vue'))")
    }
  })
})
