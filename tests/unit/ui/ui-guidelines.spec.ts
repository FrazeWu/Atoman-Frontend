import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const readVueSources = (directory: string): string[] => readdirSync(resolve(process.cwd(), directory), { withFileTypes: true })
  .flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return readVueSources(path)
    return entry.name.endsWith('.vue') ? [read(path)] : []
  })

describe('UI 准则', () => {
  it('移动端顶栏隐藏模块导航并禁止导航文字换行', () => {
    const source = read('src/components/system/AppTopbar.vue')

    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.nav\s*\{[\s\S]*?display:\s*none/)
    expect(source).toMatch(/\.nav-link-name\s*\{[\s\S]*?white-space:\s*nowrap/)
  })

  it('登录后的移动端顶栏使用紧凑图标操作', () => {
    const source = read('src/components/system/AppTopbarAuthControls.vue')

    expect(source).not.toContain('<svg')
    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.topbar-search-wrap\s*\{[\s\S]*?width:\s*36px/)
    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.user-name[\s\S]*?display:\s*none/)
  })

  it('共享标题使用固定字号且全站字距归零', () => {
    const pageHeader = read('src/components/ui/PPageHeader.vue')
    const sectionHeader = read('src/components/ui/PSectionHeader.vue')
    const globalStyle = read('src/style.css')

    expect(pageHeader).not.toMatch(/font-size:\s*clamp\([^;]*vw/)
    expect(sectionHeader).not.toMatch(/font-size:\s*clamp\([^;]*vw/)
    expect(globalStyle).toMatch(/letter-spacing:\s*0\s*!important/)
  })

  it('所有页面都不使用视口宽度连续缩放字号', () => {
    for (const source of readVueSources('src')) {
      expect(source).not.toMatch(/font-size:\s*(?:clamp\()?[^;\n]*vw/)
    }
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

  it('播放器在移动端避让底部导航', () => {
    const source = read('src/components/music/AudioPlayer.vue')

    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.player\s*\{[\s\S]*?bottom:\s*calc\(64px/)
  })

  it('用户文案不描述后台或未完成状态', () => {
    expect(read('src/components/music/AudioPlayer.vue')).not.toContain('歌词即将到来')
    expect(read('src/components/setting/SettingFeedSourcePanel.vue')).not.toContain('方便后台识别')
    expect(read('src/views/setting/SettingMusicReview.vue')).not.toMatch(/后台审核|后台驳回|后台取消/)
  })

  it('页面结构标签使用用户可读的中文', () => {
    const sources = [
      'src/components/blog/PostEditorSidebar.vue',
      'src/components/music/NestedActionDrawer.vue',
      'src/components/music/AlbumDrawer.vue',
      'src/components/music/ArtistDrawer.vue',
      'src/components/system/MobileMoreSheet.vue',
      'src/views/portal/PortalView.vue',
      'src/views/feed/FeedRecommendedView.vue',
      'src/views/timeline/TimelineHomeView.vue',
      'src/views/blog/PostDetailView.vue',
      'src/views/system/UnknownSiteView.vue',
    ].map(read).join('\n')

    expect(sources).not.toMatch(/>\s*(?:DEFAULT|Music Wiki|Basic|Portrait|Archive|Source|Diff|Album Notes|COVER|Unknown Artist|Tracklist|MORE|LOAD FAILED|EMPTY|ARTICLES|MIXED OVERVIEW|CHANNELS|COMPARE POOL|EVENT SOURCE|LANE COMPARE|MAP VIEW|Abstract|UNKNOWN SPACE)\s*</)
  })

  it('面板和音频操作不使用英文命令', () => {
    expect(read('src/components/ui/PSheet.vue')).not.toMatch(/>CLOSE<|title: 'VIEW'/)
    expect(read('src/components/ui/PSheetTab.vue')).not.toContain('Close sheet')
    expect(read('src/components/shared/PEditorRuntime.vue')).not.toContain('>Quote<')
    expect(read('src/views/feed/FeedItemDetailView.vue')).not.toMatch(/AUDIO_ENCLOSURE|PAUSE|PLAY AUDIO|DURATION:/)
    expect(read('src/components/feed/SubscriptionAddSheet.vue')).not.toContain('ADD_SUBSCRIPTION')
    expect(read('src/components/feed/SubscriptionManageSheet.vue')).not.toContain('SUBSCRIPTION_MANAGE')
    expect(read('src/components/setting/SettingFeedSourceItemsSheet.vue')).not.toContain('SOURCE_ITEMS')
  })
})
