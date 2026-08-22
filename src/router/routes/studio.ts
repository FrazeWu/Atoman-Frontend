import type { RouteRecordRaw } from "vue-router";

const studioContentView = () => import("@/views/studio/StudioContentView.vue");
const studioEditorRouteView = () => import("@/views/studio/StudioEditorRouteView.vue");

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
				path: ":module(blog|podcast|video)",
				component: () => import("@/views/studio/StudioModuleLayout.vue"),
				children: [
					{
						path: "",
						redirect: (to) => `/studio/${String(to.params.module)}/content`,
					},
					{
						path: "new",
						name: "studio-content-new",
						components: {
							default: studioContentView,
							overlay: studioEditorRouteView,
						},
						meta: {
							studioOverlay: true,
							studioOverlayMode: "new",
						},
					},
					{
						path: ":id/edit",
						name: "studio-content-edit",
						components: {
							default: studioContentView,
							overlay: studioEditorRouteView,
						},
						meta: {
							studioOverlay: true,
							studioOverlayMode: "edit",
						},
					},
					{
						path: "content",
						name: "studio-content",
						component: studioContentView,
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
