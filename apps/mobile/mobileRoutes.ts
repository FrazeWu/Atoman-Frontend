// pi-lens-ignore: typescript:2307
import type { RouteRecordRaw } from "vue-router";
import { mobileInitialRoutes } from "./mobileInitialRoutes";
import { mobileAdditionalRoutes } from './mobileAdditionalRoutes';

const requiresAuth = { requiresAuth: true };
const mobileSavedView = () => import('./MobileSavedView.vue');
export { MOBILE_MODULES } from "./mobileInitialRoutes";

export const mobileRoutes: RouteRecordRaw[] = [
	...mobileInitialRoutes.filter((route) => route.path !== "/:pathMatch(.*)*"),
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
		path: "/me",
		component: () => import("@/views/user/MyHubView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/feed",
		component: () => import("@/views/feed/FeedLayout.vue"),
		children: [
			{ path: 'explore', component: () => import('@/views/feed/FeedRecommendedView.vue') },
			{ path: 'stats', component: () => import('@/views/feed/FeedStatsView.vue'), meta: requiresAuth },
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
				component: mobileSavedView,
				props: { page: 'feed-reading' },
				meta: requiresAuth,
			},
			{
				path: "starred",
				component: mobileSavedView,
				props: { page: 'feed-starred' },
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
		path: '/posts/articles',
		component: () => import('@/views/blog/BlogArticlesView.vue'),
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
		component: mobileSavedView,
		props: { page: 'blog-bookmarks' },
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
			{ path: 'albums', component: () => import('@/views/music/AlbumsView.vue') },
			{ path: 'artists', component: () => import('@/views/music/ArtistsView.vue') },
			{ path: 'imports', component: () => import('@/views/music/ImportsView.vue'), meta: requiresAuth },
			{ path: 'library', redirect: '/music/bookmarks', meta: requiresAuth },
			{ path: 'starred', redirect: '/music/bookmarks', meta: requiresAuth },
			{
				path: "discover",
				component: () => import("@/views/music/DiscoverView.vue"),
			},
			{
				path: "tags",
				component: () => import("@/views/music/MusicTagsView.vue"),
			},
			{
				path: "tags/:tagId",
				component: () => import("@/views/music/MusicTagView.vue"),
			},
			{ path: "songs", component: () => import("@/views/music/SongsView.vue") },
			{
				path: "playlists",
				name: "mobile-music-playlists",
				component: () => import("@/views/music/PlaylistsView.vue"),
				meta: requiresAuth,
			},
			{
				path: "bookmarks",
				component: mobileSavedView,
				props: { page: 'music-library' },
				meta: requiresAuth,
			},
			{
				path: "history",
				component: mobileSavedView,
				props: { page: 'music-history' },
				meta: requiresAuth,
			},
			{
				path: "me",
				component: () => import("@/views/music/MusicProfileView.vue"),
				meta: requiresAuth,
			},
			{ path: "more", component: () => import("@/views/music/MusicMoreView.vue") },

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
	...mobileAdditionalRoutes,
];
