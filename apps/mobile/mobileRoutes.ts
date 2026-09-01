// pi-lens-ignore: typescript:2307
import type { RouteRecordRaw } from "vue-router";
import { studioRoutes } from "@/router/routes/studio";

const requiresAuth = { requiresAuth: true };

export const MOBILE_MODULES = ["feed", "blog", "music"] as const;

export const mobileRoutes: RouteRecordRaw[] = [
	{ path: "/", redirect: "/feed" },
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
		path: "/modules",
		component: () => import("./MobileModuleDirectoryView.vue"),
	},
	{
		path: "/inbox",
		component: () => import("@/views/feed/InboxPage.vue"),
		meta: requiresAuth,
	},
	{
		path: "/feed",
		component: () => import("@/views/feed/FeedLayout.vue"),
		children: [
			{
				path: "",
				component: () => import("@/views/feed/FeedRecommendedView.vue"),
			},
			{
				path: "sources",
				component: () => import("./FeedSourcesView.vue"),
				meta: requiresAuth,
			},
			{
				path: "subscriptions",
				component: () => import("@/views/feed/FeedView.vue"),
				meta: requiresAuth,
			},
			{
				path: "reading-list",
				component: () => import("@/views/feed/FeedReadingListView.vue"),
				meta: requiresAuth,
			},
			{
				path: "starred",
				component: () => import("@/views/feed/FeedStarredView.vue"),
				meta: requiresAuth,
			},
			{
				path: "item/:id",
				component: () => import("@/views/feed/FeedItemDetailView.vue"),
			},
		],
	},
	{
		path: "/posts",
		component: () => import("@/views/blog/BlogHomeView.vue"),
	},
	{
		path: "/posts/notes",
		component: () => import("@/views/blog/ShortNoteTimelineView.vue"),
	},
	{
		path: "/posts/notes/:id/edit",
		component: () => import("@/views/blog/ShortNoteComposerView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/posts/notes/:id",
		component: () => import("@/views/blog/ShortNoteDetailView.vue"),
	},
	{
		path: "/posts/subscriptions",
		component: () => import("@/views/blog/BlogSubscriptionsView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/posts/bookmarks",
		component: () => import("@/views/blog/BookmarkView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/post/:id",
		component: () => import("@/views/blog/PostDetailView.vue"),
	},
	{
		path: "/posts/post/:id",
		component: () => import("@/views/blog/PostDetailView.vue"),
	},
	{
		path: "/channel/:slug",
		component: () => import("@/views/blog/ChannelView.vue"),
	},
	{
		path: "/posts/channel/:slug",
		component: () => import("@/views/blog/ChannelView.vue"),
	},
	{
		path: "/channels/:slug",
		component: () => import("@/views/blog/ChannelView.vue"),
	},
	{
		path: "/channels/:slug/posts",
		component: () => import("@/views/blog/ChannelView.vue"),
	},
	{
		path: "/channels/:slug/about",
		component: () => import("@/views/blog/ChannelView.vue"),
	},
	{
		path: "/collection/:id",
		component: () => import("@/views/blog/CollectionView.vue"),
	},
	{
		path: "/users/:handle",
		component: () => import("@/views/blog/ProfileView.vue"),
	},
	{
		path: "/users/:handle/posts",
		component: () => import("@/views/blog/ProfileView.vue"),
	},
	{
		path: "/users/:handle/channels",
		component: () => import("@/views/blog/ProfileView.vue"),
	},
	{
		path: "/users/:handle/settings",
		component: () => import("@/views/user/UserSettingsView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/music",
		component: () => import("./MobileMusicLayout.vue"),
		children: [
			{ path: "", component: () => import("@/views/music/DiscoverView.vue") },
			{
				path: "discover",
				component: () => import("@/views/music/DiscoverView.vue"),
			},
			{ path: "songs", component: () => import("@/views/music/SongsView.vue") },
			{
				path: "playlists",
				name: "mobile-music-playlists",
				component: () => import("./MusicPlaylistsView.vue"),
				meta: requiresAuth,
			},
			{
				path: "bookmarks",
				component: () => import("@/views/music/LibraryView.vue"),
				meta: requiresAuth,
			},
			{
				path: "history",
				component: () => import("@/views/music/HistoryView.vue"),
				meta: requiresAuth,
			},
			{
				path: "me",
				component: () => import("@/views/music/MusicProfileView.vue"),
				meta: requiresAuth,
			},
			{ path: "player", component: () => import("./MobilePlayerView.vue") },
			{ path: "lyrics", component: () => import("./MobileLyricsView.vue") },
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
				component: () => import("./MobileSongView.vue"),
			},
			{
				path: "playlist/:playlistId",
				component: () => import("@/views/music/MusicPlaylistRouteView.vue"),
			},
		],
	},
	{
		path: "/videos/watch/:id",
		component: () => import("@/views/video/VideoDetailView.vue"),
	},
	...studioRoutes,
	{
		path: "/:pathMatch(.*)*",
		component: () => import("@/views/system/NotFoundView.vue"),
	},
];
