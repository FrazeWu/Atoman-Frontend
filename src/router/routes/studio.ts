import type {
	RouteLocation,
	RouteLocationRaw,
	RouteRecordRaw,
} from "vue-router";

const studioContentView = () => import("@/views/studio/StudioContentView.vue");
const studioEditorRouteView = () =>
	import("@/views/studio/StudioEditorRouteView.vue");
const manageCollectionsRedirect = (to: RouteLocation): RouteLocationRaw => ({
	path: "/studio/manage/collections",
	query: to.query,
	hash: to.hash,
});

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
				path: "manage",
				component: () => import("@/views/studio/StudioManagementLayout.vue"),
				children: [
					{
						path: "",
						redirect: "/studio/manage/channel",
					},
					{
						path: "channel",
						name: "studio-manage-channel",
						component: () => import("@/views/studio/StudioChannelView.vue"),
					},
					{
						path: "calendar",
						name: "studio-manage-calendar",
						component: () => import("@/views/studio/StudioCalendarView.vue"),
					},
					{
						path: "goals",
						name: "studio-manage-goals",
						component: () => import("@/views/studio/StudioGoalsView.vue"),
					},
					{
						path: "collections",
						name: "studio-manage-collections",
						component: () =>
							import("@/views/studio/StudioUnifiedCollectionsView.vue"),
					},
					{
						path: "collections/:id",
						name: "studio-manage-collection",
						component: () =>
							import("@/views/studio/StudioUnifiedCollectionDetailView.vue"),
					},
				],
			},
			{
				path: "channel/collections",
				name: "studio-channel-collections",
				redirect: manageCollectionsRedirect,
			},
			{
				path: "channel",
				name: "studio-channel",
				redirect: "/studio/manage/channel",
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
						redirect: manageCollectionsRedirect,
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
						component: () => import("@/views/studio/StudioInteractionsView.vue"),
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
