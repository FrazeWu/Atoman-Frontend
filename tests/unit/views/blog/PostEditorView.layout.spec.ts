import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')
const sidebarSource = readFileSync(resolve(process.cwd(), 'src/components/blog/PostEditorSidebar.vue'), 'utf8')
const settingsSource = readFileSync(resolve(process.cwd(), 'src/components/blog/PostMetaSettingsPanel.vue'), 'utf8')
const detailSource = readFileSync(resolve(process.cwd(), 'src/views/blog/PostDetailView.vue'), 'utf8')
const globalStyle = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')

function cssRules(selector: string, css = source) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Array.from(css.matchAll(new RegExp(`${escaped} \\{[\\s\\S]*?\\}`, 'g')), (match) => match[0]).join('\n')
}

describe('PostEditorView layout', () => {
  it('lets the editor surface fill the available blog workspace width', () => {
    expect(cssRules('.col-center')).toContain('display: flex')
    expect(cssRules('.col-center')).toContain('min-width: 0')
    expect(cssRules('.editor-workspace')).toContain('flex: 1')
    expect(cssRules('.editor-canvas')).toContain('flex: 1')
  })

  it('does not constrain the editor page with the generic sidebar content width', () => {
    expect(cssRules('.a-main-content > .editor-page', globalStyle)).toContain('max-width: none')
    expect(cssRules('.a-main-content > .editor-page', globalStyle)).toContain('padding: 0')
  })

  it('does not expose or submit per-post comment switches', () => {
    expect(source).not.toContain('allow_comments')
    expect(sidebarSource).not.toContain('allowComments')
    expect(settingsSource).not.toContain('允许评论')
  })

  it('connects post details to the shared blog comment target', () => {
    expect(detailSource).toContain("@/components/comment/CommentSection.vue")
    expect(detailSource).toContain("kind: 'blog_post', resourceId: post.id")
    expect(detailSource).not.toContain('comment-mode')
  })
})
