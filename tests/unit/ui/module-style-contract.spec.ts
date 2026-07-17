import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const videoFiles = [
  'src/views/video/VideoEditorView.vue',
  'src/views/video/VideoDetailView.vue',
  'src/views/video/VideoManageView.vue',
  'src/views/video/VideoHomeView.vue',
  'src/views/video/VideoSubscriptionsView.vue',
  'src/views/video/VideoFavoritesView.vue',
  'src/components/shared/PVideoPlayerShell.vue',
]
const musicFiles = [
  'src/views/music/ArtistsView.vue',
  'src/views/music/ExploreView.vue',
  'src/views/music/StarredView.vue',
  'src/components/music/ArtistDrawer.vue',
  'src/components/music/AlbumDrawer.vue',
  'src/components/music/PlaylistDrawer.vue',
  'src/components/music/NestedActionDrawer.vue',
]
const shellFiles = [
  'src/style.css',
  'src/components/system/AppSidebar.vue',
  'src/components/system/AppTopbar.vue',
  'src/components/system/AppTopbarAuthControls.vue',
  'src/components/system/MobileBottomNav.vue',
  'src/components/system/MobileMoreSheet.vue',
  'src/components/system/TopbarSearchSection.vue',
  'src/components/shared/CommentThread.vue',
  'src/components/shared/InteractionBar.vue',
  'src/components/shared/PEditorRuntime.vue',
  'src/components/setting/SettingFeedSourcePanel.vue',
  'src/views/setting/SettingAccessView.vue',
  'src/components/setting/SettingMusicReviewPanel.vue',
  'src/components/setting/SettingRolesPanel.vue',
]
const blogFeedFiles = [
  'src/components/blog/CommentSection.vue',
  'src/components/blog/PostCoverField.vue',
  'src/components/blog/PostEditorSidebar.vue',
  'src/components/blog/PostEditorTopbar.vue',
  'src/components/feed/FeedArticleSheet.vue',
  'src/components/feed/FeedSidebarSources.vue',
  'src/components/feed/FeedSourceArticlesSheet.vue',
  'src/components/feed/FeedSourceIdentityCard.vue',
  'src/components/feed/FeedTimelineFooter.vue',
  'src/components/feed/SubscriptionAddSheet.vue',
  'src/components/feed/SubscriptionManageSheet.vue',
  'src/views/blog/BlogHomeView.vue',
  'src/views/blog/BlogManageView.vue',
  'src/views/blog/BlogSubscriptionsView.vue',
  'src/views/blog/BookmarkView.vue',
  'src/views/blog/ChannelManageDetailView.vue',
  'src/views/blog/ChannelManageView.vue',
  'src/views/blog/ChannelView.vue',
  'src/views/blog/CollectionManageView.vue',
  'src/views/blog/CollectionView.vue',
  'src/views/blog/PostDetailView.vue',
  'src/views/blog/PostEditorView.vue',
  'src/views/blog/ProfileView.vue',
  'src/views/feed/FeedItemDetailView.vue',
  'src/views/feed/FeedReadingListView.vue',
  'src/views/feed/FeedRecommendedView.vue',
  'src/views/feed/FeedStarredView.vue',
  'src/views/feed/FeedStatsView.vue',
  'src/views/feed/FeedView.vue',
  'src/views/feed/InboxPage.vue',
]
const remainingModuleFiles = [
  'src/components/debate/ArgumentNode.vue',
  'src/components/debate/DebateHeaderActions.vue',
  'src/components/forum/ForumReplyNode.vue',
  'src/components/podcast/PodcastCommentSection.vue',
  'src/views/debate/DebateHomeView.vue',
  'src/views/forum/ForumHomeView.vue',
  'src/views/forum/ForumSearchView.vue',
  'src/views/forum/ForumTopicView.vue',
  'src/views/podcast/PodcastEditorView.vue',
  'src/views/podcast/PodcastEpisodeView.vue',
  'src/views/podcast/PodcastFavoritesView.vue',
  'src/views/podcast/PodcastHomeView.vue',
  'src/views/podcast/PodcastShowView.vue',
  'src/views/podcast/PodcastSubscriptionsView.vue',
  'src/views/podcast/creator/PodcastCreatorAnalytics.vue',
  'src/views/podcast/creator/PodcastCreatorDashboard.vue',
  'src/views/podcast/creator/PodcastCreatorManage.vue',
  'src/views/timeline/PersonListView.vue',
  'src/views/timeline/PersonMapView.vue',
  'src/views/timeline/TimelineHomeView.vue',
  'src/views/timeline/TimelineMapPane.vue',
  'src/views/portal/HomeView.vue',
  'src/views/portal/PortalView.vue',
  'src/views/system/AboutView.vue',
  'src/views/system/NotFoundView.vue',
  'src/views/system/UnknownSiteView.vue',
]

describe('module style contract', () => {
  it('keeps video surfaces flat, 4px, and headings at 500', () => {
    for (const path of videoFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })

  it('keeps music surfaces flat, 4px, and free of hand-drawn icons', () => {
    for (const path of musicFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|999px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
      expect(source, path).not.toContain('<svg')
    }
  })

  it('keeps shell and settings title surfaces on the global contract', () => {
    for (const path of shellFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })

  it('keeps Blog and Feed surfaces on the global contract', () => {
    for (const path of blogFeedFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })

  it('keeps remaining module surfaces on the global contract', () => {
    for (const path of remainingModuleFiles) {
      const source = read(path)
      expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/)
      expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/)
      expect(source, path).not.toMatch(/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/)
    }
  })
})
