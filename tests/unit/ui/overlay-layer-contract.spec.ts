import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const styleSource = read('src/style.css')
const sheetSource = read('src/components/ui/PSheet.vue')
const playerSource = read('src/components/music/AudioPlayer.vue')
const lyricsSource = read('src/components/music/MusicLyricsPanel.vue')
const lyricEditorSource = read('src/components/music/MusicLyricEditorDrawer.vue')
const topbarSource = read('src/components/system/AppTopbar.vue')
const mobileNavSource = read('src/components/system/MobileBottomNav.vue')

describe('overlay layer contract', () => {
  it('defines one ordered semantic layer scale', () => {
    expect(styleSource).toContain('--a-z-navigation: 100;')
    expect(styleSource).toContain('--a-z-sheet-backdrop: 300;')
    expect(styleSource).toContain('--a-z-sheet: 310;')
    expect(styleSource).toContain('--a-z-modal-backdrop: 500;')
    expect(styleSource).toContain('--a-z-modal: 510;')
    expect(styleSource).toContain('--a-z-toast: 600;')
    expect(styleSource).toContain('--a-z-player-lyrics: 700;')
    expect(styleSource).toContain('--a-z-player-queue: 710;')
    expect(styleSource).toContain('--a-z-player: 720;')
    expect(styleSource).toContain('--a-z-player-sheet-backdrop: 730;')
    expect(styleSource).toContain('--a-z-player-sheet: 740;')
    expect(styleSource).toContain('--a-z-player-modal-backdrop: 750;')
    expect(styleSource).toContain('--a-z-player-modal: 760;')

    expect(sheetSource).toContain('z-index: var(--a-z-sheet);')
    expect(playerSource).toContain('z-index: var(--a-z-player-lyrics);')
    expect(playerSource).toContain('z-index: var(--a-z-player-queue);')
    expect(lyricsSource).toContain('z-index: var(--a-z-player-lyrics);')
    expect(topbarSource).toContain('z-index: var(--a-z-navigation);')
    expect(mobileNavSource).toContain('z-index: var(--a-z-navigation);')
    expect(lyricEditorSource).toContain('above-player')
    expect(lyricsSource).toMatch(/<PConfirm[\s\S]*above-player/)
    expect(sheetSource).toMatch(/\.p-sheet-root--above-player \.p-sheet-backdrop\s*\{[^}]*z-index: var\(--a-z-player-sheet-backdrop\);/)
    expect(sheetSource).toMatch(/\.p-sheet-root--above-player \.p-sheet-layer\s*\{[^}]*z-index: var\(--a-z-player-sheet\);/)
    expect(styleSource).toMatch(/\.p-modal-backdrop--above-player\s*\{[^}]*z-index: var\(--a-z-player-modal-backdrop\);/)
    expect(styleSource).toMatch(/\.p-modal-backdrop--above-player \.p-modal\s*\{[^}]*z-index: var\(--a-z-player-modal\);/)
  })

  it('reserves content and sheet height only for visible fixed chrome', () => {
    expect(styleSource).toContain('--a-topbar-height: 56px;')
    expect(styleSource).toContain('--a-player-height: 84px;')
    expect(styleSource).toContain('--a-player-reserved-height: 0px;')
    expect(styleSource).toContain("html[data-player-active='true'][data-player-pinned='true']")
    expect(styleSource).toContain('--a-player-reserved-height: var(--a-player-height);')
    expect(styleSource).toContain("html[data-player-active='true'][data-player-pinned]")
    expect(styleSource).toContain('height: calc(100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset));')
    expect(sheetSource).toContain('bottom: var(--a-content-bottom-offset);')
    expect(styleSource).toContain('body:has(.app-shell.has-sidebar)')
    expect(styleSource).toMatch(/body:has\(\.app-shell\.has-sidebar\) \{[^}]*--a-content-bottom-offset:/s)
    expect(styleSource).toContain('--a-mobile-nav-reserved-height: calc(64px + env(safe-area-inset-bottom, 0px));')
    expect(playerSource).toContain('height: var(--a-mobile-player-height);')
  })

  it('keeps the exposed sheet edge at the exact stack offset', () => {
    expect(sheetSource).toContain('transform: translateX(calc(-1 * var(--a-sheet-shift, 0px)));')
    expect(sheetSource).not.toContain('translateX(calc(-1 * var(--a-sheet-shift, 0px))) scale(')
  })
})
