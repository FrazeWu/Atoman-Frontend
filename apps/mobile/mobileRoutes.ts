// pi-lens-ignore: typescript:2307
import type { RouteRecordRaw } from "vue-router";
import { mobileInitialRoutes } from "./mobileInitialRoutes";
import { mobileAdditionalRoutes } from './mobileAdditionalRoutes';
import { readSearchQuery, writeSearchQuery, unifiedSearchEnabled } from '@/utils/searchUrl'

const requiresAuth = { requiresAuth: true };
export { MOBILE_MODULES } from "./mobileInitialRoutes";

export const mobileRoutes: RouteRecordRaw[] = [
	...mobileInitialRoutes.filter((route) => route.path !== "/:pathMatch(.*)*"),
	{
		path: "/auth/oauth/callback",
		component: () => import("@/views/auth/OAuthCallbackView.vue"),
		meta: { authLayout: true },
	},
	{
		path: "/auth/oauth/verify-email",
		component: () => import("@/views/auth/OAuthVerifyEmailView.vue"),
		meta: { authLayout: true },
	},
	{
		path: "/auth/oauth/complete-profile",
		component: () => import("@/views/auth/OAuthCompleteProfileView.vue"),
		meta: { authLayout: true },
	},
	{
		path: "/auth/oauth/confirm-account",
		component: () => import("@/views/auth/OAuthConfirmAccountView.vue"),
		meta: { authLayout: true },
	},
	{
		path: "/auth/oauth/set-password",
		component: () => import("@/views/auth/OAuthSetPasswordView.vue"),
		meta: { authLayout: true },
	},
	{ path: "/about", component: () => import("@/views/system/AboutView.vue") },
	{ path: "/terms", component: () => import("@/views/system/TermsView.vue") },
	{ path: "/privacy", component: () => import("@/views/system/PrivacyView.vue") },
	{
		path: "/modules",
		component: () => import("./MobileModuleDirectoryView.vue"),
	},
	{
		path: "/inbox",
		component: () => import("./views/messages/MessagesMobileView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/inbox/notifications",
		component: () => import("./views/messages/MessagesNotificationsView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/inbox/contacts",
		component: () => import("./views/messages/MessagesContactsView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/inbox/me",
		component: () => import("./views/messages/MessagesMeView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/inbox/chat/:id",
		component: () => import("./views/messages/MessageChatMobileView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/messages/chat/:id",
		component: () => import("./views/messages/MessageChatMobileView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/notifications",
		redirect: "/inbox/notifications",
	},
	{
		path: "/messages",
		component: () => import("./views/messages/MessagesMobileView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/me",
		component: () => import("./views/me/ProfileMobileView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/studio",
		component: () => import("./views/studio/StudioMobileView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/books",
		component: () => import("./views/books/BooksDiscoverView.vue"),
	},
	{
		path: "/books/shelf",
		component: () => import("./views/books/BooksShelfView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/books/notes",
		component: () => import("./views/books/BooksNotesView.vue"),
	},
	{
		path: "/books/me",
		component: () => import("./views/books/BooksMeView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/books/work/:id",
		component: () => import("./views/books/BookDetailMobileView.vue"),
	},
	{
		path: "/books/read/:assetId",
		component: () => import("@/views/books/BookReaderView.vue"),
	},
	{
		path: "/books/read/:id",
		component: () => import("@/views/books/BookReaderView.vue"),
	},
	{
		path: "/debate",
		component: () => import("./views/debate/DebateHallView.vue"),
	},
	{
		path: "/feed",
		component: () => import("./MobileFeedLayout.vue"),
		children: [
			{ path: 'explore', component: () => import('./views/feed/FeedStreamView.vue') },
			{ path: 'stats', component: () => import('@/views/feed/FeedStatsView.vue'), meta: requiresAuth },
			{
				path: "",
				component: () => import("./views/feed/FeedStreamView.vue"),
			},
			{
				path: "following",
				component: () => import("./views/feed/FeedFollowingView.vue"),
			},
			{
				path: "starred",
				component: () => import("./views/feed/FeedStarredView.vue"),
			},
			{
				path: "me",
				component: () => import("./views/feed/FeedMeView.vue"),
				meta: { restoreSession: true },
			},
			{
				path: "sources",
				component: () => import("./views/feed/FeedSourcesView.vue"),
				meta: requiresAuth,
			},
			{
				path: "subscriptions",
				component: () => import("./views/feed/FeedStreamView.vue"),
				props: { initialTab: 'subscriptions' },
				meta: requiresAuth,
			},
			{
				path: "reading-list",
				component: () => import("./views/feed/FeedStreamView.vue"),
				props: { initialTab: 'reading-list' },
				meta: requiresAuth,
			},
			{
				path: "starred",
				component: () => import("./views/feed/FeedStreamView.vue"),
				props: { initialTab: 'starred' },
				meta: requiresAuth,
			},
			{
				path: "article/:id",
				component: () => import("./views/feed/FeedArticleReaderView.vue"),
			},
			{
				path: "item/:id",
				component: () => import("./views/feed/FeedArticleReaderView.vue"),
			},
		],
	},
	{
		path: "/posts",
		component: () => import("./views/blog/BlogDiscoverView.vue"),
	},
	{
		path: '/posts/articles',
		component: () => import('./views/blog/BlogArticlesView.vue'),
	},
	{
		path: "/posts/notes",
		component: () => import("./views/blog/BlogNotesTimelineView.vue"),
	},
	{
		path: "/posts/notes/:id/edit",
		component: () => import("@/views/blog/ShortNoteComposerView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/posts/notes/:id",
		component: () => import("./views/blog/ShortNoteDetailMobileView.vue"),
	},
	{
		path: "/posts/me",
		component: () => import("./views/blog/BlogMeView.vue"),
		meta: { restoreSession: true },
	},
	{
		path: "/posts/subscriptions",
		component: () => import("@/views/blog/BlogSubscriptionsView.vue"),
		meta: requiresAuth,
	},
	{
		path: "/posts/bookmarks",
		component: () => import("./views/blog/BlogMeView.vue"),
		props: { initialTab: 'bookmarks' },
		meta: requiresAuth,
	},
	{
		path: "/post/:id",
		component: () => import("./views/blog/BlogPostReaderView.vue"),
	},
	{
		path: "/posts/post/:id",
		component: () => import("./views/blog/BlogPostReaderView.vue"),
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
			{ path: "", component: () => import("./views/music/MusicDiscoverView.vue") },
			{ path: 'albums', redirect: '/music/search?tab=albums' },
			{ path: 'artists', redirect: '/music/search?tab=artists' },
			{ path: 'imports', component: () => import('@/views/music/ImportsView.vue'), meta: requiresAuth },
			{ path: 'search', component: () => import("./views/music/MusicSearchView.vue") },
			{ path: 'library', redirect: '/music/search' },
			{ path: 'starred', redirect: '/music/bookmarks', meta: requiresAuth },
			{
				path: "discover",
				component: () => import("./views/music/MusicDiscoverView.vue"),
			},
			{
				path: "tags",
				component: () => import("@/views/music/MusicTagsView.vue"),
			},
			{
				path: "tags/:tagId",
				component: () => import("@/views/music/MusicTagView.vue"),
			},
			{ path: "songs", redirect: '/music/search?tab=songs' },
			{
				path: "playlists",
				name: "mobile-music-playlists",
				component: () => import("./views/music/MusicPlaylistsView.vue"),
			},
			{
				path: "bookmarks",
				component: () => import("./views/music/MusicLibraryView.vue"),
				meta: requiresAuth,
			},
			{
				path: "history",
				component: () => import("./views/music/MusicLibraryView.vue"),
				props: { initialTab: 'history' },
				meta: requiresAuth,
			},
			{
				path: "me",
				component: () => import("./views/music/MusicMeView.vue"),
				meta: { restoreSession: true },
			},
			{ path: "more", component: () => import("@/views/music/MusicMoreView.vue") },

			{ path: "player", component: () => import("./MobilePlayerView.vue") },
			{ path: "lyrics", component: () => import("./MobileLyricsView.vue") },
			{
				path: "artist/:artistId",
				component: () => import("./views/music/MusicArtistDetailView.vue"),
			},
			{
				path: "album/:albumId",
				component: () => import("./views/music/MusicAlbumDetailView.vue"),
			},
			{
				path: "song/:songId",
				component: () => import("./MobileSongView.vue"),
			},
			{
				path: "playlist/:playlistId",
				component: () => import("./views/music/MusicPlaylistDetailView.vue"),
			},
		],
	},
	...mobileAdditionalRoutes,
];
