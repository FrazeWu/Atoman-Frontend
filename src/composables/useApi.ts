export function useApiUrl() {
	const configuredUrl = import.meta.env.VITE_API_URL?.trim();
	const baseUrl =
		configuredUrl && configuredUrl !== "undefined" ? configuredUrl : "/api/v1";
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

	if (normalizedBaseUrl.endsWith("/api/v1")) return normalizedBaseUrl;
	if (normalizedBaseUrl.endsWith("/api")) return `${normalizedBaseUrl}/v1`;
	return `${normalizedBaseUrl}/api/v1`;
}

export function useWebSocketUrl(path: string) {
	const apiUrl = useApiUrl();

	if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
		try {
			const url = new URL(apiUrl);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			url.pathname = path;
			url.search = "";
			url.hash = "";
			return url.toString();
		} catch {
			return path;
		}
	}

	if (typeof window !== "undefined") {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}${path}`;
	}

	return path;
}

export function useApiWebSocketUrl(path: string) {
	const apiUrl = useApiUrl();
	let apiPath = apiUrl;
	if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
		try {
			apiPath = new URL(apiUrl).pathname;
		} catch {
			apiPath = "/api/v1";
		}
	}
	const normalizedPath = path.replace(/^\/+/, "");
	return useWebSocketUrl(`${apiPath.replace(/\/$/, "")}/${normalizedPath}`);
}

export function useApi() {
	const apiUrl = useApiUrl();
	const publicRSSURL = (path: string) => {
		const value = `${apiUrl}${path}`;
		if (/^https?:\/\//.test(value) || typeof window === "undefined") return value;
		return new URL(value, window.location.origin).toString();
	};
	const discussionTarget = (kind: string, resourceId: string) =>
		`${apiUrl}/discussions/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`;

	return {
		url: apiUrl,
		v1: {
			url: apiUrl,
			uploads: `${apiUrl}/uploads`,
			music: {
				artists: `${apiUrl}/music/artists`,
				artist: (id: string) => `${apiUrl}/music/artists/${id}`,
				albums: `${apiUrl}/music/albums`,
				album: (id: string) => `${apiUrl}/music/albums/${id}`,
				songs: `${apiUrl}/music/songs`,
				song: (id: string) => `${apiUrl}/music/songs/${id}`,
			},
			forum: {
				categories: `${apiUrl}/forum/categories`,
				moderators: `${apiUrl}/forum/moderation/moderators`,
				moderator: (id: string) => `${apiUrl}/forum/moderation/moderators/${id}`,
				reports: `${apiUrl}/forum/moderation/reports`,
				resolveReport: (id: string) =>
					`${apiUrl}/forum/moderation/reports/${id}/resolve`,
				userActions: `${apiUrl}/forum/moderation/user-actions`,
				applyUserAction: (id: string) =>
					`${apiUrl}/forum/moderation/users/${id}/actions`,
				moderationUsers: `${apiUrl}/forum/moderation/users`,
				groups: `${apiUrl}/forum/groups`,
				group: (id: string) => `${apiUrl}/forum/groups/${id}`,
				groupMember: (groupId: string, userId: string) =>
					`${apiUrl}/forum/groups/${groupId}/members/${userId}`,
				categoryPermissions: `${apiUrl}/forum/category-permissions`,
				categoryPermission: (id: string) =>
					`${apiUrl}/forum/category-permissions/${id}`,
			},
		},
		music: {
			albumRevisions: (id: number | string) => `${apiUrl}/albums/${id}/revisions`,
			albumRevision: (id: number | string, version: number | string) =>
				`${apiUrl}/albums/${id}/revisions/${version}`,
			albumRevisionDiff: (id: number | string) =>
				`${apiUrl}/albums/${id}/revisions/diff`,
			albumRevert: (id: number | string, version: number | string) =>
				`${apiUrl}/albums/${id}/revisions/${version}/revert`,
			albumDiscussions: (id: number | string) =>
				`${apiUrl}/albums/${id}/discussions`,
			albumEntryStatus: (id: number | string) =>
				`${apiUrl}/albums/${id}/entry-status`,
			albumProtection: (id: number | string) =>
				`${apiUrl}/albums/${id}/protection`,
			artistEntryStatus: (id: number | string) =>
				`${apiUrl}/artists/${id}/entry-status`,
			artistDiscussions: (id: number | string) =>
				`${apiUrl}/artists/${id}/discussions`,
			adminMusicReview: `${apiUrl}/admin/music/entries`,
			adminMusicQuality: `${apiUrl}/admin/music/quality`,
			adminMusicConfirm: (id: number | string, type: "album" | "artist") =>
				type === "album"
					? `${apiUrl}/albums/${id}/entry-status`
					: `${apiUrl}/artists/${id}/entry-status`,
		},

		blog: {
			channels: `${apiUrl}/blog/channels`,
			channel: (id: number | string) => `${apiUrl}/blog/channels/${id}`,
			channelEnsureDefault: `${apiUrl}/blog/channels/ensure-default`,
			channelCollections: (id: number | string) =>
				`${apiUrl}/blog/channels/${id}/collections`,
			channelBySlug: (slug: string) => `${apiUrl}/blog/channels/slug/${slug}`,
			channelCollectionsBySlug: (slug: string) =>
				`${apiUrl}/blog/channels/slug/${slug}/collections`,
			collections: `${apiUrl}/blog/collections`,
			collection: (id: number | string) => `${apiUrl}/blog/collections/${id}`,

			posts: `${apiUrl}/blog/posts`,
			search: `${apiUrl}/blog/search`,
			recommendPosts: `${apiUrl}/blog/recommend/posts`,
			recommendationFeedback: `${apiUrl}/blog/recommendation-feedback`,
			recommendationFeedbackItem: (id: number | string) =>
				`${apiUrl}/blog/recommendation-feedback/${id}`,
			digest: `${apiUrl}/blog/digest`,
			relatedPosts: (id: number | string) => `${apiUrl}/blog/posts/${id}/related`,
			post: (id: number | string) => `${apiUrl}/blog/posts/${id}`,
			postRating: (id: number | string) => `${apiUrl}/blog/posts/${id}/rating`,
			postPublish: (id: number | string) => `${apiUrl}/blog/posts/${id}/publish`,
			postUnpublish: (id: number | string) =>
				`${apiUrl}/blog/posts/${id}/unpublish`,
			postPin: (id: number | string) => `${apiUrl}/blog/posts/${id}/pin`,
			postUnpin: (id: number | string) => `${apiUrl}/blog/posts/${id}/unpin`,
			postVersions: (id: number | string) => `${apiUrl}/blog/posts/${id}/versions`,
			postExport: (id: number | string) => `${apiUrl}/blog/posts/${id}/export`,
			postVersionRestore: (id: number | string, version: number) =>
				`${apiUrl}/blog/posts/${id}/versions/${version}/restore`,
			draft: `${apiUrl}/blog/drafts`,
			drafts: `${apiUrl}/blog/posts/drafts`,
			collectionPostOrder: (id: number | string) =>
				`${apiUrl}/blog/collections/${id}/posts/order`,
			uploadImage: `${apiUrl}/blog/upload-image`,
			markdownImport: `${apiUrl}/blog/imports/markdown`,
			markdownImportDetails: (id: number | string) =>
				`${apiUrl}/blog/imports/markdown/${id}`,
			markdownImportConfirm: (id: number | string) =>
				`${apiUrl}/blog/imports/markdown/${id}/confirm`,

			shortNotes: `${apiUrl}/short-notes`,
			shortNote: (id: number | string) => `${apiUrl}/short-notes/${id}`,
			shortNoteLike: (id: number | string) => `${apiUrl}/short-notes/${id}/like`,

			comments: (id: number | string) =>
				`${apiUrl}/discussions/blog_post/${encodeURIComponent(id)}/comments`,
			postComments: (id: number | string) =>
				`${apiUrl}/discussions/blog_post/${encodeURIComponent(id)}/comments`,

			likes: `${apiUrl}/blog/likes`,
			postLikesCount: (id: number | string) =>
				`${apiUrl}/blog/posts/${id}/likes/count`,

			bookmarkFolders: `${apiUrl}/blog/bookmark-folders`,
			bookmarkFolder: (id: number | string) =>
				`${apiUrl}/blog/bookmark-folders/${id}`,
			bookmarks: `${apiUrl}/blog/bookmarks`,
			bookmark: (id: number | string) => `${apiUrl}/blog/bookmarks/${id}`,
		},

		studio: {
			state: `${apiUrl}/studio/state`,
			channels: `${apiUrl}/studio/channels`,
			channel: (id: string) => `${apiUrl}/studio/channels/${id}`,
			dashboard: `${apiUrl}/studio/dashboard`,
			calendar: `${apiUrl}/studio/calendar`,
			goals: `${apiUrl}/studio/goals`,
			goalCycles: `${apiUrl}/studio/goals/cycles`,
			goalCycleGoals: (id: string) => `${apiUrl}/studio/goals/cycles/${id}/goals`,
			goal: (id: string) => `${apiUrl}/studio/goals/${id}`,
			goalActions: (id: string) => `${apiUrl}/studio/goals/${id}/actions`,
			goalAction: (id: string) => `${apiUrl}/studio/goals/actions/${id}`,
			goalReview: (id: string) => `${apiUrl}/studio/goals/cycles/${id}/review`,
			contents: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/contents`,
			unifiedContents: `${apiUrl}/studio/contents`,
			unifiedCollections: `${apiUrl}/studio/collections`,
			unifiedCollection: (id: string) => `${apiUrl}/studio/collections/${id}`,
			unifiedCollectionContents: (id: string) =>
				`${apiUrl}/studio/collections/${id}/contents`,
			unifiedCollectionCandidates: (id: string) =>
				`${apiUrl}/studio/collections/${id}/candidates`,
			unifiedCollectionContent: (id: string, contentId: string) =>
				`${apiUrl}/studio/collections/${id}/contents/${contentId}`,
			reorderUnifiedCollectionContents: (id: string) =>
				`${apiUrl}/studio/collections/${id}/contents/order`,
			collections: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/collections`,
			collection: (module: "blog" | "podcast" | "video", id: string) =>
				`${apiUrl}/studio/${module}/collections/${id}`,
			reorderCollectionContents: (
				module: "blog" | "podcast" | "video",
				id: string,
			) => `${apiUrl}/studio/${module}/collections/${id}/contents/order`,
			resolveCollectionConflict: (
				module: "blog" | "podcast" | "video",
				id: string,
			) => `${apiUrl}/studio/${module}/contents/${id}/collection`,
			resolveCollectionConflicts: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/contents/collections/resolve`,
			analytics: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/analytics`,
			interactions: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/interactions`,
			interactionStates: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/interactions/states`,
			interactionState: (module: "blog" | "podcast" | "video", id: string) =>
				`${apiUrl}/studio/${module}/interactions/${id}/state`,
			replyTemplates: `${apiUrl}/studio/reply-templates`,
			replyTemplate: (id: string) => `${apiUrl}/studio/reply-templates/${id}`,
			settings: (module: "blog" | "podcast" | "video") =>
				`${apiUrl}/studio/${module}/settings`,
			share: (module: "blog" | "podcast" | "video", id: string) =>
				`${apiUrl}/studio/${module}/contents/${id}/share`,
		},

		content: {
			events: `${apiUrl}/content/events`,
			progress: `${apiUrl}/content/progress`,
			progressItem: (module: "blog" | "podcast" | "video", id: string) =>
				`${apiUrl}/content/progress/${module}/${id}`,
			continue: `${apiUrl}/content/continue`,
			notificationPreferences: `${apiUrl}/content/notification-preferences`,
			schedule: (module: "blog" | "podcast" | "video", id: string) =>
				`${apiUrl}/content/${module}/${id}/schedule`,
		},

		interactions: {
			blogLikes: `${apiUrl}/blog/likes`,
			blogPostComments: (postId: number | string) =>
				`${apiUrl}/discussions/blog_post/${encodeURIComponent(postId)}/comments`,
			blogComment: (commentId: number | string) =>
				`${apiUrl}/comments/${encodeURIComponent(commentId)}`,
			shortNoteComments: (noteId: number | string) =>
				`${apiUrl}/discussions/short_note/${noteId}/comments`,
			forumTopicLike: (topicId: number | string) =>
				`${apiUrl}/forum/topics/${topicId}/like`,
			forumTopicComments: (topicId: number | string) =>
				`${apiUrl}/discussions/forum_topic/${topicId}/comments`,
			forumComment: (commentId: number | string) =>
				`${apiUrl}/comments/${commentId}`,
			videoComments: (videoId: number | string) =>
				`${apiUrl}/discussions/video/${videoId}/comments`,
			videoComment: (commentId: number | string) =>
				`${apiUrl}/comments/${commentId}`,
		},

		auth: {
			register: `${apiUrl}/auth/register`,
			login: `${apiUrl}/auth/login`,
			session: `${apiUrl}/auth/session`,
			checkEmail: `${apiUrl}/auth/check-email`,
			checkUsername: `${apiUrl}/auth/check-username`,
			sendVerification: `${apiUrl}/auth/send-verification`,
			verifyEmail: `${apiUrl}/auth/verify-email`,
			passwordResetSendCode: `${apiUrl}/auth/password-reset/send-code`,
			passwordReset: `${apiUrl}/auth/password-reset`,
			onboardingComplete: `${apiUrl}/auth/onboarding/complete`,
			onboardingRecommendations: `${apiUrl}/feed/onboarding/recommendations`,
		},

		settings: {
			publicSiteAccess: `${apiUrl}/settings/public/site-access`,
			siteAccess: `${apiUrl}/settings/site-access`,
		},

		admin: {
			siteAccess: `${apiUrl}/admin/site-access`,
			announcements: `${apiUrl}/admin/announcements`,
			feed: {
				sources: `${apiUrl}/admin/feed/sources`,
				source: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/sources/${sourceId}`,
				sourceImpact: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/sources/${sourceId}/impact`,
				sourceDiagnostics: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/sources/${sourceId}/diagnostics`,
				onboardingRecommendations: `${apiUrl}/admin/feed/onboarding/recommendations`,
				onboardingRecommendation: (recommendationId: number | string) =>
					`${apiUrl}/admin/feed/onboarding/recommendations/${recommendationId}`,
				opmlImport: `${apiUrl}/feed/sources/opml/import`,
				opmlRetryImport: `${apiUrl}/feed/sources/retry-import`,
				opmlExport: `${apiUrl}/feed/sources/opml/export`,
			},
			feedFulltext: {
				health: `${apiUrl}/admin/feed/fulltext/health`,
				settings: `${apiUrl}/admin/feed/fulltext/settings`,
				crawl: `${apiUrl}/admin/feed/fulltext/crawl`,
				sources: `${apiUrl}/admin/feed/fulltext/sources`,
				source: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/fulltext/sources/${sourceId}`,
				items: `${apiUrl}/admin/feed/fulltext/items`,
				sourceSettings: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/fulltext/sources/${sourceId}/settings`,
				syncSource: (sourceId: number | string) =>
					`${apiUrl}/admin/feed/fulltext/sources/${sourceId}/sync`,
				retryItem: (itemId: number | string) =>
					`${apiUrl}/admin/feed/fulltext/items/${itemId}/retry`,
			},
		},

		site: {
			access: `${apiUrl}/site/access`,
			resolve: (handle: string) =>
				`${apiUrl}/site/resolve/${encodeURIComponent(handle)}`,
		},

		users: {
			search: `${apiUrl}/users/search`,
			me: `${apiUrl}/users/me`,
			settings: `${apiUrl}/users/me`, // profile update (display_name, bio, etc)
			meSettings: `${apiUrl}/users/me/settings`,
			profile: (username: string) => `${apiUrl}/users/by-username/${username}`,
			roles: `${apiUrl}/users/roles`,
			role: (userUuid: string) => `${apiUrl}/users/${userUuid}/role`,
			follow: (userUuid: string) => `${apiUrl}/users/${userUuid}/follow`,
			followers: (userUuid: string) => `${apiUrl}/users/${userUuid}/followers`,
			following: (userUuid: string) => `${apiUrl}/users/${userUuid}/following`,
			blocked: `${apiUrl}/users/blocked`,
			block: (userUuid: string) => `${apiUrl}/users/${userUuid}/block`,
		},

		feed: {
			subscriptions: `${apiUrl}/feed/subscriptions`,
			subscription: (id: number) => `${apiUrl}/feed/subscriptions/${id}`,
			timeline: `${apiUrl}/feed/timeline`,
			sourceTimeline: `${apiUrl}/feed/timeline`,
			explore: `${apiUrl}/feed/explore`,
			exploreSources: `${apiUrl}/feed/explore/sources`,
		},

		rss: {
			user: (username: string) =>
				publicRSSURL(`/rss/users/${encodeURIComponent(username)}.xml`),
			channel: (slug: string) =>
				publicRSSURL(`/rss/channels/${encodeURIComponent(slug)}.xml`),
			collection: (id: string) =>
				publicRSSURL(`/rss/collections/${encodeURIComponent(id)}.xml`),
		},

		notifications: {
			list: `${apiUrl}/notifications`,
			unreadCount: `${apiUrl}/notifications/unread-count`,
			unreadCounts: `${apiUrl}/notifications/unread-counts`,
			markRead: (id: string) => `${apiUrl}/notifications/${id}/read`,
			markCategoryRead: (category: string) =>
				`${apiUrl}/notifications/read-all?category=${encodeURIComponent(category)}`,
			markAllRead: `${apiUrl}/notifications/read-all`,
			preferences: `${apiUrl}/notifications/preferences`,
			mutes: `${apiUrl}/notifications/mutes`,
		},

		comments: {
			roots: (kind: string, resourceId: string) =>
				`${discussionTarget(kind, resourceId)}/comments`,
			replies: (rootId: string) =>
				`${apiUrl}/comments/${encodeURIComponent(rootId)}/replies`,
			comment: (commentId: string) =>
				`${apiUrl}/comments/${encodeURIComponent(commentId)}`,
			like: (commentId: string) =>
				`${apiUrl}/comments/${encodeURIComponent(commentId)}/like`,
			report: (commentId: string) =>
				`${apiUrl}/comments/${encodeURIComponent(commentId)}/report`,
			mark: (kind: string, resourceId: string) =>
				`${discussionTarget(kind, resourceId)}/pinned-comment`,
			reports: `${apiUrl}/admin/comment-reports`,
			moderation: (commentId: string) =>
				`${apiUrl}/admin/comments/${encodeURIComponent(commentId)}/moderation`,
			mentionUsers: `${apiUrl}/users/search`,
			upload: `${apiUrl}/uploads`,
		},

		videos: {
			list: `${apiUrl}/videos`,
			create: `${apiUrl}/videos`,
			get: (id: string) => `${apiUrl}/videos/${id}`,
			update: (id: string) => `${apiUrl}/videos/${id}`,
			delete: (id: string) => `${apiUrl}/videos/${id}`,
			reprocess: (id: string) => `${apiUrl}/videos/${id}/reprocess`,
			uploadVideo: `${apiUrl}/videos/upload-video`,
			uploadCover: `${apiUrl}/videos/upload-cover`,
			incrementView: (id: string) => `${apiUrl}/videos/${id}/view`,
			recommended: (id: string) => `${apiUrl}/videos/${id}/recommended`,
			bookmarks: `${apiUrl}/videos/bookmarks`,
			bookmark: (id: string) => `${apiUrl}/videos/bookmarks/${id}`,
			comments: (id: string) =>
				`${apiUrl}/discussions/video/${encodeURIComponent(id)}/comments`,
			comment: (commentId: string) =>
				`${apiUrl}/comments/${encodeURIComponent(commentId)}`,
		},

		podcast: {
			episodes: `${apiUrl}/podcast/episodes`,
			episode: (id: string) => `${apiUrl}/podcast/episodes/${id}`,
			playback: (id: string) => `${apiUrl}/podcast/episodes/${id}/playback`,
			showEpisodes: (channelSlug: string) =>
				`${apiUrl}/podcast/shows/${channelSlug}/episodes`,
			bookmarks: `${apiUrl}/podcast/bookmarks`,
			bookmark: (id: string) => `${apiUrl}/podcast/bookmarks/${id}`,
			showBookmarks: `${apiUrl}/podcast/show-bookmarks`,
			showBookmark: (id: string) => `${apiUrl}/podcast/show-bookmarks/${id}`,
			comments: (id: string) =>
				`${discussionTarget("podcast_episode", id)}/comments`,
			comment: (id: string) => `${apiUrl}/comments/${encodeURIComponent(id)}`,
			uploadAudio: `${apiUrl}/podcast/upload-audio`,
			uploadCover: `${apiUrl}/podcast/upload-cover`,
		},
	};
}
