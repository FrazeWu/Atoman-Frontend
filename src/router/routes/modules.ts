import type { RouteRecordRaw } from 'vue-router'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { settingRoutes } from '@/router/routes/settings'

function musicBookmarksPath(path: string) {
  return path.startsWith('/music/') ? '/music/bookmarks' : '/bookmarks'
}

export function commonModuleRoutes(): RouteRecordRaw[] {
  return [
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/register', component: () => import('@/views/auth/LoginView.vue'), meta: { authLayout: true } },
    { path: '/forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { authLayout: true } },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ]
}

export const moduleFeatureRoutes: Record<ModuleRoomKey, RouteRecordRaw[]> = {
  blog: [
    {
      path: '/',
      component: () => import('@/views/blog/BlogLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/blog/BlogHomeView.vue') },
        { path: 'notes', component: () => import('@/views/blog/ShortNoteTimelineView.vue') },
        { path: 'notes/:id', component: () => import('@/views/blog/ShortNoteDetailView.vue') },
        { path: 'notes/:id/edit', component: () => import('@/views/blog/ShortNoteComposerView.vue'), meta: { requiresAuth: true } },
        { path: 'subscriptions', component: () => import('@/views/blog/BlogSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'bookmarks', component: () => import('@/views/blog/BookmarkView.vue'), meta: { requiresAuth: true } },
      ],
    },
    { path: '/channel/:slug', component: () => import('@/views/blog/ChannelView.vue') },
    { path: '/collection/:id', component: () => import('@/views/blog/CollectionView.vue') },
    {
      path: '/post/:id',
      component: () => import('@/views/blog/PostDetailView.vue'),
      beforeEnter: to => to.params.id === 'new' ? '/__not_found__' : true,
    },
  ],
  music: [
    {
      path: '/',
      component: () => import('@/views/music/MusicLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/music/DiscoverView.vue') },
        { path: 'discover', component: () => import('@/views/music/DiscoverView.vue') },
        { path: 'albums', component: () => import('@/views/music/AlbumsView.vue') },
        { path: 'songs', component: () => import('@/views/music/SongsView.vue') },
        { path: 'artists', component: () => import('@/views/music/ArtistsView.vue') },
        {
          path: 'starred',
          redirect: to => ({
            path: musicBookmarksPath(to.path),
            query: to.query,
            hash: to.hash,
          }),
          meta: { requiresAuth: true },
        },
        {
          path: 'library',
          redirect: to => ({
            path: musicBookmarksPath(to.path),
            query: to.query,
            hash: to.hash,
          }),
          meta: { requiresAuth: true },
        },
        { path: 'bookmarks', component: () => import('@/views/music/LibraryView.vue'), meta: { requiresAuth: true } },
        { path: 'history', component: () => import('@/views/music/HistoryView.vue'), meta: { requiresAuth: true } },
        { path: 'imports', component: () => import('@/views/music/ImportsView.vue'), meta: { requiresAuth: true } },
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
        { path: 'song/:songId', component: () => import('@/views/music/MusicSongRouteView.vue') },
        { path: 'playlist/:playlistId', component: () => import('@/views/music/MusicPlaylistRouteView.vue') },
        {
          path: 'album/:albumId/edit',
          redirect: (to) => `/music?editor=album-edit&album=${to.params.albumId}`,
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
  feed: [
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
  ],
  forum: [
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
  ],
  debate: [
    {
      path: '/',
      component: () => import('@/views/debate/DebateLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/debate/DebateHomeView.vue') },
        { path: 'rules', component: () => import('@/views/debate/DebateRulesView.vue') },
        { path: ':id', component: () => import('@/views/debate/DebateTopicView.vue') },
      ],
    },
  ],
  timeline: [
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
  ],
  podcast: [
    {
      path: '/',
      component: () => import('@/views/podcast/PodcastLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('../../views/podcast/PodcastHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/podcast/PodcastSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'favorites', component: () => import('@/views/podcast/PodcastFavoritesView.vue'), meta: { requiresAuth: true } },
        { path: 'show/:channelSlug', component: () => import('@/views/podcast/PodcastShowView.vue') },
        { path: 'episode/:id', component: () => import('@/views/podcast/PodcastEpisodeView.vue') },
      ],
    },
  ],
  video: [
    {
      path: '/',
      component: () => import('@/views/video/VideoLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/video/VideoHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/video/VideoSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'favorites', component: () => import('@/views/video/VideoFavoritesView.vue'), meta: { requiresAuth: true } },
        { path: 'watch/:id', component: () => import('@/views/video/VideoDetailView.vue') },
      ],
    },
    { path: '/watch/:id', redirect: (to) => `/videos/watch/${to.params.id}` },
  ],
}

export const moduleRoutes = Object.fromEntries(
  Object.entries(moduleFeatureRoutes).map(([module, routes]) => [
    module,
    [...settingRoutes, ...routes, ...commonModuleRoutes()],
  ]),
) as Record<ModuleRoomKey, RouteRecordRaw[]>
