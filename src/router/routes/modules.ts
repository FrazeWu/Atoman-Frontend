import type { RouteRecordRaw } from 'vue-router'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { settingRoutes } from '@/router/routes/settings'

export const moduleRoutes: Record<ModuleRoomKey, RouteRecordRaw[]> = {
  blog: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/blog/BlogLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/blog/BlogHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/blog/BlogSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'manage', component: () => import('@/views/blog/BlogManageView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
        { path: 'post/new', component: () => import('@/views/blog/PostEditorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'post.create' } } },
        { path: 'post/:id/edit', component: () => import('@/views/blog/PostEditorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'post.create' } } },
        { path: 'bookmarks', component: () => import('@/views/blog/BookmarkView.vue'), meta: { requiresAuth: true } },
      ],
    },
    { path: '/channels', component: () => import('@/views/blog/ChannelManageView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/channel/:slug', component: () => import('@/views/blog/ChannelView.vue') },
    { path: '/channel/:slug/manage', component: () => import('@/views/blog/ChannelManageDetailView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/collections', component: () => import('@/views/blog/CollectionManageView.vue'), meta: { requiresAuth: true, featureGate: { module: 'blog', feature: 'channel.manage' } } },
    { path: '/collection/:id', component: () => import('@/views/blog/CollectionView.vue') },
    { path: '/post/:id', component: () => import('@/views/blog/PostDetailView.vue') },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  music: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/music/MusicLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/music/HomeView.vue') },
        { path: 'discover', component: () => import('@/views/music/ExploreView.vue') },
        { path: 'artists', component: () => import('@/views/music/ArtistsView.vue') },
        { path: 'starred', component: () => import('@/views/music/StarredView.vue') },
        { path: 'history', component: () => import('@/views/music/HistoryView.vue'), meta: { requiresAuth: true } },
        {
          path: 'artist/new',
          redirect: (to) => {
            const query = new URLSearchParams({ editor: 'artist-create' })
            if (typeof to.query.name === 'string' && to.query.name.trim()) {
              query.set('name', to.query.name.trim())
            }
            return `/music?${query.toString()}`
          },
          meta: { requiresAuth: true },
        },
        { path: 'artist/:artistId', component: () => import('@/views/music/MusicArtistRouteView.vue') },
        { path: 'album/:albumId', component: () => import('@/views/music/MusicAlbumRouteView.vue') },
        { path: 'playlist/:playlistId', component: () => import('@/views/music/MusicPlaylistRouteView.vue') },
        {
          path: 'album/:albumId/edit',
          redirect: (to) => `/music?editor=album-edit&album=${to.params.albumId}`,
          meta: { requiresAuth: true },
        },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  feed: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/feed/FeedLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        // allow guest view on feed home (tests expect public landing), auth required for subpages
        { path: '', component: () => import('@/views/feed/FeedView.vue') },
        { path: 'explore', component: () => import('@/views/feed/FeedRecommendedView.vue') },

        { path: 'stats', component: () => import('@/views/feed/FeedStatsView.vue'), meta: { requiresAuth: true } },
        { path: 'item/:id', component: () => import('@/views/feed/FeedItemDetailView.vue') },
        { path: 'starred', component: () => import('@/views/feed/FeedStarredView.vue'), meta: { requiresAuth: true } },
        { path: 'reading-list', component: () => import('@/views/feed/FeedReadingListView.vue'), meta: { requiresAuth: true } },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  forum: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/forum/ForumLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/forum/ForumHomeView.vue') },
        { path: 'search', component: () => import('@/views/forum/ForumSearchView.vue') },
        { path: 'new', component: () => import('@/views/forum/ForumNewTopicView.vue'), meta: { requiresAuth: true, featureGate: { module: 'forum', feature: 'topic.create' } } },
        { path: 'topic/:id', component: () => import('@/views/forum/ForumTopicView.vue') },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  debate: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/debate/DebateLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/debate/DebateHomeView.vue') },
        { path: ':id', component: () => import('@/views/debate/DebateTopicView.vue') },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  timeline: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/timeline/TimelineLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/timeline/TimelineHomeView.vue') },
        { path: 'persons', component: () => import('@/views/timeline/PersonListView.vue') },
        { path: 'person/:id', component: () => import('@/views/timeline/PersonMapView.vue') },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  podcast: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/podcast/PodcastLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/podcast/PodcastHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/podcast/PodcastSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'favorites', component: () => import('@/views/podcast/PodcastFavoritesView.vue'), meta: { requiresAuth: true } },
        { path: 'creator', component: () => import('@/views/podcast/PodcastCreatorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
        { path: 'show/:channelSlug', component: () => import('@/views/podcast/PodcastShowView.vue') },
        { path: 'episode/:id', component: () => import('@/views/podcast/PodcastEpisodeView.vue') },
        { path: 'editor/:id?', component: () => import('@/views/podcast/PodcastEditorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
      ],
    },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
  video: [
    ...settingRoutes,
    {
      path: '/',
      component: () => import('@/views/video/VideoLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/video/VideoHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/video/VideoSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'favorites', component: () => import('@/views/video/VideoFavoritesView.vue'), meta: { requiresAuth: true } },
        { path: 'creator', component: () => import('@/views/video/VideoManageView.vue'), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'manage', redirect: '/videos/creator' },
        { path: 'upload', component: () => import('@/views/video/VideoEditorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'edit/:id', component: () => import('@/views/video/VideoEditorView.vue'), meta: { requiresAuth: true, featureGate: { module: 'video', feature: 'video.publish' } } },
        { path: 'videos/watch/:id', component: () => import('@/views/video/VideoDetailView.vue') },
      ],
    },
    { path: '/watch/:id', redirect: (to) => `/videos/watch/${to.params.id}` },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ],
}
