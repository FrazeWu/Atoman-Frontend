import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const editorSource = readFileSync(resolve(__dirname, '../../../../src/views/blog/PostEditorView.vue'), 'utf8')
const sidebarSource = readFileSync(resolve(__dirname, '../../../../src/components/blog/PostEditorSidebar.vue'), 'utf8')

describe('PostEditor directory layout', () => {
  it('moves the outline into the shared independent directory', () => {
    expect(editorSource).toContain("import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'")
    expect(editorSource).toContain('<PDirectoryNav')
    expect(editorSource).toContain(':items="directoryItems"')
    expect(editorSource).toContain(':active-id="activeDirectoryId"')
    expect(editorSource).toContain('v-model:collapsed="directoryCollapsed"')
    expect(editorSource).toContain(':mobile-open="mobilePanel === \'outline\'"')
    expect(sidebarSource).not.toContain('toc-panel')
    expect(sidebarSource).not.toContain('outlineCount')
    expect(sidebarSource).not.toContain('flattenedOutline')
    expect(sidebarSource).not.toContain('jump-to-heading')
  })

  it('expands the editor canvas when the directory is collapsed', () => {
    expect(editorSource).toContain("'is-directory-collapsed': directoryCollapsed")
    expect(editorSource).toMatch(/\.editor-layout\.is-directory-collapsed\s*\{[^}]*grid-template-columns:/s)
  })
})
