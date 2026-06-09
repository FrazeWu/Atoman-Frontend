import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')
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
})
