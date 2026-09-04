import type { RouteRecordRaw } from "vue-router";
import type { ModuleRoomKey } from "@/config/moduleRooms";
import { settingRoutes } from "@/router/routes/settings";

function musicBookmarksPath(path: string) {
	return path.startsWith("/music/") ? "/music/bookmarks" : "/bookmarks";
}

export function commonModuleRoutes(): RouteRecordRaw[] {
	return [
		{
			path: "/login",
			component: () => import("@/views/auth/LoginView.vue"),
			meta: { authLayout: true },
		},
		{
			path: "/register",
			component: () => import("@/views/auth/LoginView.vue"),
			meta: { authLayout: true },
		},
		{
			path: "/forgot-password",
			component: () => import("@/views/auth/ForgotPasswordView.vue"),
			meta: { authLayout: true },
		},
		{
			path: "/:pathMatch(.*)*",
			component: () => import("@/views/system/NotFoundView.vue"),
		},
	];
}

export const moduleFeatureRoutes: Record<ModuleRoomKey, RouteRecordRaw[]> = {
	blog: [
		{
			path: "/",
			component: () => import("@/views/blog/BlogLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{ path: "", component: () => import("@/views/blog/BlogHomeView.vue") },
				{ path: "articles", component: () => import("@/views/blog/BlogArticlesView.vue") },
				{
					path: "notes",
					component: () => import("@/views/blog/ShortNoteTimelineView.vue"),
				},
				{
					path: "notes/:id",
					component: () => import("@/views/blog/ShortNoteDetailView.vue"),
				},
				{
					path: "notes/:id/edit",
					component: () => import("@/views/blog/ShortNoteComposerView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "subscriptions",
					component: () => import("@/views/blog/BlogSubscriptionsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "bookmarks",
					component: () => import("@/views/blog/BookmarkView.vue"),
					meta: { requiresAuth: true },
				},
			],
		},
		{
			path: "/channel/:slug",
			component: () => import("@/views/blog/ChannelView.vue"),
		},
		{
			path: "/collection/:id",
			component: () => import("@/views/blog/CollectionView.vue"),
		},
		{
			path: "/post/:id",
			component: () => import("@/views/blog/PostDetailView.vue"),
			beforeEnter: (to) => (to.params.id === "new" ? "/__not_found__" : true),
		},
	],
	music: [
		{
			path: "/",
			component: () => import("@/views/music/MusicLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{ path: "", component: () => import("@/views/music/DiscoverView.vue") },
				{
					path: "discover",
					component: () => import("@/views/music/DiscoverView.vue"),
				},
				{
					path: "albums",
					component: () => import("@/views/music/AlbumsView.vue"),
				},
				{
					path: "songs",
					component: () => import("@/views/music/SongsView.vue"),
				},
				{
					path: "artists",
					component: () => import("@/views/music/ArtistsView.vue"),
				},
				{
					path: "starred",
					redirect: (to) => ({
						path: musicBookmarksPath(to.path),
						query: to.query,
						hash: to.hash,
					}),
					meta: { requiresAuth: true },
				},
				{
					path: "library",
					redirect: (to) => ({
						path: musicBookmarksPath(to.path),
						query: to.query,
						hash: to.hash,
					}),
					meta: { requiresAuth: true },
				},
				{
					path: "playlists",
					component: () => import("@/views/music/PlaylistsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "bookmarks",
					component: () => import("@/views/music/LibraryView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "history",
					component: () => import("@/views/music/HistoryView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "me",
					component: () => import("@/views/music/MusicProfileView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "imports",
					component: () => import("@/views/music/ImportsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "more",
					component: () => import("@/views/music/MusicMoreView.vue"),
				},
				{
					path: "artist/new",
					redirect: (to) => {
						const query = new URLSearchParams({ editor: "artist-create" });
						if (typeof to.query.name === "string" && to.query.name.trim()) {
							query.set("name", to.query.name.trim());
						}
						return `/music?${query.toString()}`;
					},
					meta: { requiresAuth: true },
				},
				{
					path: "artist/:artistId",
					component: () => import("@/views/music/MusicArtistRouteView.vue"),
				},
				{
					path: "album/:albumId",
					component: () => import("@/views/music/MusicAlbumRouteView.vue"),
				},
				{
					path: "song/:songId",
					component: () => import("@/views/music/MusicSongRouteView.vue"),
				},
				{
					path: "playlist/:playlistId",
					component: () => import("@/views/music/MusicPlaylistRouteView.vue"),
				},
				{
					path: "album/:albumId/edit",
					redirect: (to) => `/music?editor=album-edit&album=${to.params.albumId}`,
					meta: { requiresAuth: true },
				},
			],
		},
	],
	books: [
		{
			path: "/",
			component: () => import("@/views/books/BooksLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{ path: "", component: () => import("@/views/books/BooksHomeView.vue") },
				{ path: "search", component: () => import("@/views/books/BooksHomeView.vue") },
				{ path: "work/:workId", component: () => import("@/views/books/BookWorkView.vue") },
				{ path: "edition/:editionId", component: () => import("@/views/books/BookEditionView.vue") },
				{
					path: "library",
					component: () => import("@/views/books/BooksHomeView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "import/:importId",
					component: () => import("@/views/books/BooksHomeView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "read/:assetId",
					component: () => import("@/views/books/BookReaderView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "public-read/:assetId",
					component: () => import("@/views/books/BookPublicReaderView.vue"),
				},
				{
					path: "contributions",
					component: () => import("@/views/books/BooksGovernanceView.vue"),
					meta: {
						requiresAuth: true,
						featureGate: { module: "books", feature: "books.submit" },
					},
				},
				{
					path: "review",
					component: () => import("@/views/books/BooksGovernanceView.vue"),
					meta: {
						requiresAuth: true,
						featureGate: { module: "books", feature: "books.review" },
					},
				},
			],
		},
	],
	feed: [
		{
			path: "/",
			component: () => import("@/views/feed/FeedLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				// Exploration is the public feed landing; subscriptions remain available explicitly.
				{
					path: "",
					component: () => import("@/views/feed/FeedRecommendedView.vue"),
				},
				{
					path: "sources",
					component: () => import("@/views/feed/FeedView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "subscriptions",
					component: () => import("@/views/feed/FeedView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "explore",
					redirect: (to) => ({
						path: to.path.replace(/\/explore$/, "") || "/",
						query: to.query,
						hash: to.hash,
					}),
				},

				{
					path: "stats",
					component: () => import("@/views/feed/FeedStatsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "item/:id",
					component: () => import("@/views/feed/FeedItemDetailView.vue"),
				},
				{
					path: "starred",
					component: () => import("@/views/feed/FeedStarredView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "reading-list",
					redirect: (to) => ({
						path: "/feed/starred",
						query: { ...to.query, type: "reading" },
					}),
					meta: { requiresAuth: true },
				},
			],
		},
	],
	forum: [
		{
			path: "/",
			component: () => import("@/views/forum/ForumLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{
					path: "",
					component: () => import("@/views/forum/ForumHomeView.vue"),
				},
				{
					path: "categories",
					component: () => import("@/views/forum/ForumCategoriesView.vue"),
				},
				{
					path: "me",
					component: () => import("@/views/forum/ForumMyView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "search",
					component: () => import("@/views/forum/ForumSearchView.vue"),
				},
				{
					path: "new",
					component: () => import("@/views/forum/ForumNewTopicView.vue"),
					meta: {
						requiresAuth: true,
						featureGate: { module: "forum", feature: "topic.create" },
					},
				},
				{
					path: "topic/:id",
					component: () => import("@/views/forum/ForumTopicView.vue"),
				},
				{
					path: "topic/:id/edit",
					component: () => import("@/views/forum/ForumNewTopicView.vue"),
					meta: { requiresAuth: true },
				},
			],
		},
	],
	debate: [
		{
			path: "/",
			component: () => import("@/views/debate/DebateLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{
					path: "",
					component: () => import("@/views/debate/DebateHomeView.vue"),
				},
				{
					path: "search",
					component: () => import("@/views/debate/DebateSearchView.vue"),
				},
				{
					path: "me",
					component: () => import("@/views/debate/DebateMyView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "rules",
					component: () => import("@/views/debate/DebateRulesView.vue"),
				},
				{
					path: ":id",
					component: () => import("@/views/debate/DebateTopicView.vue"),
				},
			],
		},
	],
	timeline: [
		{
			path: "/",
			component: () => import("@/views/timeline/TimelineLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{
					path: "",
					component: () => import("@/views/timeline/TimelineHomeView.vue"),
				},
				{
					path: "persons",
					component: () => import("@/views/timeline/PersonListView.vue"),
				},
				{
					path: "search",
					component: () => import("@/views/timeline/TimelineSearchView.vue"),
				},
				{
					path: "me",
					component: () => import("@/views/timeline/TimelineMyView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "person/:id",
					component: () => import("@/views/timeline/PersonMapView.vue"),
				},
			],
		},
	],
	podcast: [
		{
			path: "/",
			component: () => import("@/views/podcast/PodcastLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{
					path: "",
					component: () => import("../../views/podcast/PodcastHomeView.vue"),
				},
				{
					path: "subscriptions",
					component: () => import("@/views/podcast/PodcastSubscriptionsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "favorites",
					component: () => import("@/views/podcast/PodcastFavoritesView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "me",
					component: () => import("@/views/podcast/PodcastProfileView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "show/:channelSlug",
					component: () => import("@/views/podcast/PodcastShowView.vue"),
				},
				{
					path: "episode/:id",
					component: () => import("@/views/podcast/PodcastEpisodeView.vue"),
				},
			],
		},
	],
	video: [
		{
			path: "/",
			component: () => import("@/views/video/VideoLayout.vue"),
			meta: { hasSidebar: true },
			children: [
				{
					path: "",
					component: () => import("@/views/video/VideoHomeView.vue"),
				},
				{
					path: "search",
					component: () => import("@/views/video/VideoSearchView.vue"),
				},
				{
					path: "subscriptions",
					component: () => import("@/views/video/VideoSubscriptionsView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "favorites",
					component: () => import("@/views/video/VideoFavoritesView.vue"),
					meta: { requiresAuth: true },
				},
				{
					path: "collections/:id",
					component: () => import("@/views/video/VideoCollectionView.vue"),
				},
				{
					path: "watch/:id",
					component: () => import("@/views/video/VideoDetailView.vue"),
				},
			],
		},
		{ path: "/watch/:id", redirect: (to) => `/videos/watch/${to.params.id}` },
	],
};

export const moduleRoutes = Object.fromEntries(
	Object.entries(moduleFeatureRoutes).map(([module, routes]) => [
		module,
		[...settingRoutes, ...routes, ...commonModuleRoutes()],
	]),
) as Record<ModuleRoomKey, RouteRecordRaw[]>;
