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
    expect(read('src/components/ui/PEmpty.vue')).toContain("kicker: ''")
    expect(read('src/components/music/MusicSidebarPlaylists.vue')).not.toContain('PLAYLISTS')
    expect(read('src/views/forum/ForumLayout.vue')).not.toMatch(/CATEGORIES|TAGS/)
    expect(read('src/components/music/MusicEditReviewShell.vue')).not.toMatch(/Music edit|approve \/ reject \/ cancel|music edits/)
  })

  it('移动端主要控件使用至少 44px 的触控高度', () => {
    const source = read('src/style.css')
    const button = read('src/components/ui/PButton.vue')
    const segmentedControl = read('src/components/ui/PSegmentedControl.vue')

    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.a-main-content :where\(button, input, select, \[role="button"\]\)[\s\S]*?min-height:\s*44px/)
    expect(button).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.p-button--sm[\s\S]*?min-height:\s*44px/)
    expect(segmentedControl).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.p-segmented-control-item[\s\S]*?min-height:\s*44px/)
  })

  it('移动端条目不使用超出容器的负边距', () => {
    const source = read('src/components/ui/PEntry.vue')

    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.p-entry[\s\S]*?margin:\s*0/)
  })

  it('应用提供路由加载占位并在模块页收起移动端页脚', () => {
    const app = read('src/App.vue')
    const footer = read('src/components/system/SiteFooter.vue')

    expect(app).toContain('route-loading-state')
    expect(app).toContain(':hide-on-mobile="hasSidebar"')
    expect(footer).toContain('site-footer--mobile-hidden')
  })

  it('门户使用等权推荐网格且不保留超大主推结构', () => {
    const source = read('src/views/portal/PortalView.vue')

    expect(source).toContain('displaySections')
    expect(source).toContain('recommendedItemKeys')
    expect(source).toContain('portal-hot__recommendation-grid')
    expect(source).toContain('portal-hot__recommendation-card')
    expect(source).toContain('portal-hot__module-strip')
    expect(source).not.toContain('portal-hot__featured')
    expect(source).not.toContain('portal-hot__lead')
  })

  it('内容首页移动端收敛主推卡片并使用中文类型占位', () => {
    const source = read('src/views/media/MediaHomeView.vue')

    expect(source).not.toContain('item.kind.toUpperCase()')
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.content-home-feature:not\(:first-child\)[\s\S]*?display:\s*none/)
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

  it('站点管理的内嵌工具不使用嵌套卡片', () => {
    expect(read('src/components/setting/SettingFeedSourcePanel.vue')).not.toContain('<PSurface')
    expect(read('src/components/setting/SettingForumModeratorPanel.vue')).not.toContain('<PSurface')
  })

  it('音乐管理使用统一表格且不使用 emoji 图标', () => {
    const source = read('src/views/setting/SettingMusicReview.vue')
    expect(source).toContain('setting-music__entries-table')
    expect(source).not.toContain('💬')
  })

  it('管理页在窄屏只保留一个主操作且工具按钮不拉伸', () => {
    const access = read('src/views/setting/SettingAccessView.vue')
    const music = read('src/views/setting/SettingMusicReview.vue')

    expect(access).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.setting-access__footer\s*\{[\s\S]*?position:\s*static/)
    expect(access).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.setting-access__save-top\s*\{[\s\S]*?display:\s*none/)
    expect(music).toMatch(/\.setting-music__entry-filters[\s\S]*?:deep\(\.p-button\)[\s\S]*?justify-self:\s*start/)
  })

  it('站点管理不暴露模块键名或强制滚动动画', () => {
    const access = read('src/views/setting/SettingAccessView.vue')
    const feed = read('src/components/setting/SettingFeedSourcePanel.vue')

    expect(access).not.toContain('key.toUpperCase()')
    expect(access).not.toContain("behavior: 'smooth'")
    expect(feed).not.toContain('external_rss')
  })
})
