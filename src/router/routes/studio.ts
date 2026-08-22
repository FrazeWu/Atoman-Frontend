import type { RouteRecordRaw } from "vue-router";

export const studioRoutes: RouteRecordRaw[] = [
	{
		path: "/studio",
		component: () => import("@/views/studio/StudioLayout.vue"),
		meta: { requiresAuth: true },
		children: [
			{
				path: "",
				name: "studio-dashboard",
				component: () => import("@/views/studio/StudioDashboardView.vue"),
			},
			{
				path: "channel/collections",
				name: "studio-channel-collections",
				component: () =>
					import("@/views/studio/StudioUnifiedCollectionsView.vue"),
			},
			{
				path: "channel",
				name: "studio-channel",
				component: () => import("@/views/studio/StudioChannelView.vue"),
			},
			{
				path: "blog",
				component: () => import("@/views/studio/StudioModuleLayout.vue"),
				meta: { studioModule: "blog" },
				children: [
					{ path: "", redirect: "/studio/blog/content" },
					{
						path: "new",
						name: "studio-blog-new",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/blog/PostEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "新建博客",
							featureGate: { module: "blog", feature: "post.create" },
						},
					},
					{
						path: ":id/edit",
						name: "studio-blog-edit",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/blog/PostEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "编辑博客",
							featureGate: { module: "blog", feature: "post.create" },
						},
					},
				],
			},
			{
				path: "podcast",
				component: () => import("@/views/studio/StudioModuleLayout.vue"),
				meta: { studioModule: "podcast" },
				children: [
					{ path: "", redirect: "/studio/podcast/content" },
					{
						path: "new",
						name: "studio-podcast-new",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/podcast/PodcastEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "新建播客",
							featureGate: { module: "podcast", feature: "podcast.publish" },
						},
					},
					{
						path: ":id/edit",
						name: "studio-podcast-edit",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/podcast/PodcastEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "编辑播客",
							featureGate: { module: "podcast", feature: "podcast.publish" },
						},
					},
				],
			},
			{
				path: "video",
				component: () => import("@/views/studio/StudioModuleLayout.vue"),
				meta: { studioModule: "video" },
				children: [
					{ path: "", redirect: "/studio/video/content" },
					{
						path: "new",
						name: "studio-video-new",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/video/VideoEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "新建视频",
							featureGate: { module: "video", feature: "video.publish" },
						},
					},
					{
						path: ":id/edit",
						name: "studio-video-edit",
						components: {
							default: () => import("@/views/studio/StudioContentView.vue"),
							overlay: () => import("@/views/video/VideoEditorView.vue"),
						},
						meta: {
							studioOverlay: true,
							studioOverlayTitle: "编辑视频",
							featureGate: { module: "video", feature: "video.publish" },
						},
					},
				],
			},
			{
				path: ":module(blog|podcast|video)",
				component: () => import("@/views/studio/StudioModuleLayout.vue"),
				children: [
					{
						path: "",
						redirect: (to) => `/studio/${String(to.params.module)}/content`,
					},
					{
						path: "content",
						name: "studio-content",
						component: () => import("@/views/studio/StudioContentView.vue"),
					},
					{
						path: "collections",
						name: "studio-module-collections",
						component: () =>
							import("@/views/studio/StudioUnifiedCollectionsView.vue"),
					},
					{
						path: "imports",
						name: "studio-imports",
						component: () => import("@/views/video/VideoImportsView.vue"),
					},
					{
						path: "analytics",
						name: "studio-analytics",
						component: () => import("@/views/studio/StudioAnalyticsView.vue"),
					},
					{
						path: "interactions",
						name: "studio-interactions",
						component: () =>
							import("@/views/studio/StudioInteractionsView.vue"),
					},
					{
						path: "settings",
						name: "studio-settings",
						component: () => import("@/views/studio/StudioSettingsView.vue"),
					},
				],
			},
		],
	},
];
