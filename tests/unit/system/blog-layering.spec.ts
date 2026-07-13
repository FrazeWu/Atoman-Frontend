import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('PostEditorView layering', () => {
  it('uses blog building blocks instead of duplicating sidebar and topbar structure', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')

    expect(source).toContain('PostEditorSidebar')
    expect(source).toContain('PostEditorTopbar')
    expect(source).not.toContain('<section class="left-section publish-section">')
    expect(source).not.toContain('<div class="meta-chip-group">')
  })
})

describe('Blog sheet layering', () => {
  it.each([
    'BlogCollectionSheet.vue',
    'BlogPostSheet.vue',
  ])('marks only the top %s as modal', (file) => {
    const source = readFileSync(path.resolve(process.cwd(), `src/components/blog/${file}`), 'utf8')

    expect(source).toContain(':is-top-layer="sheets.isTop(layer.key)"')
  })
})
