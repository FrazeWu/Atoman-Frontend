import type { RouteRecordRaw } from 'vue-router'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { settingRoutes } from '@/router/routes/settings'
import { asyncRouteView } from '@/router/asyncRouteView'
import MediaLayout from '@/views/media/MediaLayout.vue'
import BlogLayout from '@/views/blog/BlogLayout.vue'
import MusicLayout from '@/views/music/MusicLayout.vue'
import FeedLayout from '@/views/feed/FeedLayout.vue'
import ForumLayout from '@/views/forum/ForumLayout.vue'
import DebateLayout from '@/views/debate/DebateLayout.vue'
import TimelineLayout from '@/views/timeline/TimelineLayout.vue'
import PodcastLayout from '@/views/podcast/PodcastLayout.vue'
import VideoLayout from '@/views/video/VideoLayout.vue'

export const moduleRoutes: Record<ModuleRoomKey, RouteRecordRaw[]> = {
  media: [
    ...settingRoutes,
    {
      path: '/',
      component: MediaLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/media/MediaHomeView.vue')) },
        { path: 'create', component: asyncRouteView(() => import('@/views/media/MediaCreateView.vue')), meta: { requiresAuth: true } },
        { path: 'articles', component: asyncRouteView(() => import('@/views/media/MediaArticlesView.vue')) },
        { path: 'videos', component: asyncRouteView(() => import('@/views/media/MediaVideosView.vue')) },
        { path: 'videos/watch/:id', component: asyncRouteView(() => import('@/views/video/VideoDetailView.vue')) },
        { path: 'podcasts', component: asyncRouteView(() => import('@/views/media/MediaPodcastsView.vue')) },
        { path: 'podcasts/episode/:id', component: asyncRouteView(() => import('@/views/podcast/PodcastEpisodeView.vue')) },
        { path: 'subscriptions', component: asyncRouteView(() => import('@/views/media/MediaSubscriptionsView.vue')), meta: { requiresAuth: true } },
        { path: 'bookmarks', component: asyncRouteView(() => import('@/views/media/MediaBookmarksView.vue')), meta: { requiresAuth: true } },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  blog: [
    ...settingRoutes,
    {
      path: '/',
      component: BlogLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/blog/BlogHomeView.vue')) },
        { path: 'subscriptions', component: asyncRouteView(() => import('@/views/blog/BlogSubscriptionsView.vue')), meta: { requiresAuth: true } },
        { path: 'manage', component: asyncRouteView(() => import('@/views/blog/BlogManageView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
        { path: 'post/new', component: asyncRouteView(() => import('@/views/blog/PostEditorView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'post.create' } } },
        { path: 'post/:id/edit', component: asyncRouteView(() => import('@/views/blog/PostEditorView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'post.create' } } },
        { path: 'bookmarks', component: asyncRouteView(() => import('@/views/blog/BookmarkView.vue')), meta: { requiresAuth: true } },
        { path: 'settings', component: asyncRouteView(() => import('@/views/blog/UserManagementView.vue')), meta: { requiresAuth: true, hasSidebar: false } },
      ],
    },
    { path: '/channels', component: asyncRouteView(() => import('@/views/blog/ChannelManageView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/channel/:slug', component: asyncRouteView(() => import('@/views/blog/ChannelView.vue')) },
    { path: '/channel/:slug/manage', component: asyncRouteView(() => import('@/views/blog/ChannelManageDetailView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/collections', component: asyncRouteView(() => import('@/views/blog/CollectionManageView.vue')), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/collection/:id', component: asyncRouteView(() => import('@/views/blog/CollectionView.vue')) },
    { path: '/post/:id', component: asyncRouteView(() => import('@/views/blog/PostDetailView.vue')) },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  music: [
    ...settingRoutes,
    {
      path: '/',
      component: MusicLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/music/HomeView.vue')) },
        { path: 'discover', component: asyncRouteView(() => import('@/views/music/ExploreView.vue')) },
        { path: 'explore', redirect: 'discover' },
        { path: 'artists', component: asyncRouteView(() => import('@/views/music/ArtistsView.vue')) },
        { path: 'starred', component: asyncRouteView(() => import('@/views/music/StarredView.vue')) },
        { path: 'history', component: asyncRouteView(() => import('@/views/music/HistoryView.vue')), meta: { requiresAuth: true } },
        { path: 'artist/new', component: asyncRouteView(() => import('@/views/music/CreateArtistView.vue')), meta: { requiresAuth: true } },
        { path: 'artist/:artistId', component: asyncRouteView(() => import('@/views/music/MusicArtistRouteView.vue')) },
        { path: 'album/:albumId', component: asyncRouteView(() => import('@/views/music/MusicAlbumRouteView.vue')) },
        { path: 'album/:albumId/edit', component: asyncRouteView(() => import('@/views/music/EditAlbumView.vue')), meta: { requiresAuth: true } },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  feed: [
    ...settingRoutes,
    {
      path: '/',
      component: FeedLayout,
      meta: { hasSidebar: true },
      children: [
        // allow guest view on feed home (tests expect public landing), auth required for subpages
        { path: '', component: asyncRouteView(() => import('@/views/feed/FeedView.vue')) },
        { path: 'explore', component: asyncRouteView(() => import('@/views/feed/FeedRecommendedView.vue')) },
        { path: 'settings', component: asyncRouteView(() => import('@/views/feed/FeedSettingsView.vue')), meta: { requiresAuth: true, featureGate: { module: 'feed', feature: 'subscription.manage' } } },

        { path: 'stats', component: asyncRouteView(() => import('@/views/feed/FeedStatsView.vue')), meta: { requiresAuth: true } },
        { path: 'item/:id', component: asyncRouteView(() => import('@/views/feed/FeedItemDetailView.vue')) },
        { path: 'starred', component: asyncRouteView(() => import('@/views/feed/FeedStarredView.vue')), meta: { requiresAuth: true } },
        { path: 'reading-list', component: asyncRouteView(() => import('@/views/feed/FeedReadingListView.vue')), meta: { requiresAuth: true } },
        { path: 'inbox', component: asyncRouteView(() => import('@/views/feed/InboxPage.vue')), meta: { requiresAuth: true } },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  forum: [
    ...settingRoutes,
    {
      path: '/',
      component: ForumLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/forum/ForumHomeView.vue')) },
        { path: 'search', component: asyncRouteView(() => import('@/views/forum/ForumSearchView.vue')) },
        { path: 'new', component: asyncRouteView(() => import('@/views/forum/ForumNewTopicView.vue')), meta: { requiresAuth: true, featureGate: { module: 'forum', feature: 'topic.create' } } },
        { path: 'topic/:id', component: asyncRouteView(() => import('@/views/forum/ForumTopicView.vue')) },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  debate: [
    ...settingRoutes,
    {
      path: '/',
      component: DebateLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/debate/DebateHomeView.vue')) },
        { path: ':id', component: asyncRouteView(() => import('@/views/debate/DebateTopicView.vue')) },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  timeline: [
    ...settingRoutes,
    {
      path: '/',
      component: TimelineLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/timeline/TimelineHomeView.vue')) },
        { path: 'persons', component: asyncRouteView(() => import('@/views/timeline/PersonListView.vue')) },
        { path: 'person/:id', component: asyncRouteView(() => import('@/views/timeline/PersonMapView.vue')) },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  podcast: [
    ...settingRoutes,
    {
      path: '/',
      component: PodcastLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/podcast/PodcastHomeView.vue')) },
        { path: 'show/:channelSlug', component: asyncRouteView(() => import('@/views/podcast/PodcastShowView.vue')) },
        { path: 'episode/:id', component: asyncRouteView(() => import('@/views/podcast/PodcastEpisodeView.vue')) },
        { path: 'editor/:id?', component: asyncRouteView(() => import('@/views/podcast/PodcastEditorView.vue')), meta: { requiresAuth: true, featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
  video: [
    ...settingRoutes,
    {
      path: '/',
      component: VideoLayout,
      meta: { hasSidebar: true },
      children: [
        { path: '', component: asyncRouteView(() => import('@/views/video/VideoHomeView.vue')) },
        { path: 'subscriptions', component: asyncRouteView(() => import('@/views/video/VideoSubscriptionsView.vue')), meta: { requiresAuth: true } },
        { path: 'manage', component: asyncRouteView(() => import('@/views/video/VideoManageView.vue')), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'upload', component: asyncRouteView(() => import('@/views/video/VideoEditorView.vue')), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'edit/:id', component: asyncRouteView(() => import('@/views/video/VideoEditorView.vue')), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'watch/:id', component: asyncRouteView(() => import('@/views/video/VideoDetailView.vue')) },
      ],
    },
    { path: '/login', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/register', component: asyncRouteView(() => import('@/views/auth/LoginView.vue')), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: asyncRouteView(() => import('@/views/system/NotFoundView.vue')) },
  ],
}
