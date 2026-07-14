import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('UI 准则', () => {
  it('移动端顶栏隐藏模块导航并禁止导航文字换行', () => {
    const source = read('src/components/system/AppTopbar.vue')

    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.nav\s*\{[\s\S]*?display:\s*none/)
    expect(source).toMatch(/\.nav-link-name\s*\{[\s\S]*?white-space:\s*nowrap/)
  })

  it('共享标题使用固定字号且全站字距归零', () => {
    const pageHeader = read('src/components/ui/PPageHeader.vue')
    const sectionHeader = read('src/components/ui/PSectionHeader.vue')
    const globalStyle = read('src/style.css')

    expect(pageHeader).not.toMatch(/font-size:\s*clamp\([^;]*vw/)
    expect(sectionHeader).not.toMatch(/font-size:\s*clamp\([^;]*vw/)
    expect(globalStyle).toMatch(/letter-spacing:\s*0\s*!important/)
  })

  it('空状态和管理界面不暴露英文内部文案', () => {
    expect(read('src/components/ui/PEmpty.vue')).toContain("kicker: '暂无内容'")
    expect(read('src/components/music/MusicSidebarPlaylists.vue')).not.toContain('PLAYLISTS')
    expect(read('src/views/forum/ForumLayout.vue')).not.toMatch(/CATEGORIES|TAGS/)
    expect(read('src/components/music/MusicEditReviewShell.vue')).not.toMatch(/Music edit|approve \/ reject \/ cancel|music edits/)
  })

  it('页面不再渲染可见快捷键说明', () => {
    const sources = [
      'src/views/feed/FeedView.vue',
      'src/views/feed/FeedStarredView.vue',
      'src/views/feed/FeedReadingListView.vue',
      'src/views/blog/BlogSubscriptionsView.vue',
      'src/views/forum/ForumLayout.vue',
    ].map(read)

    for (const source of sources) {
      expect(source).not.toMatch(/PShortcutHints|<kbd>/)
    }
  })
})
