import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('public discussion editor loading', () => {
  it('uses the shared lightweight comment composer on forum topics', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/forum/ForumTopicView.vue'), 'utf8')
    expect(source).not.toContain("@/components/shared/PEditor.vue")
    expect(source).toContain("import CommentSection from '@/components/comment/CommentSection.vue'")
  })

  it('uses the lightweight comment composer for typed debate arguments', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/debate/DebateTopicView.vue'), 'utf8')
    expect(source).not.toContain("@/components/shared/PEditor.vue")
    expect(source).toContain("import CommentComposer from '@/components/comment/CommentComposer.vue'")
  })
})
