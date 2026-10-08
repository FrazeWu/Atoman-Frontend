// pi-lens-ignore: typescript:2307
import type { RouteRecordRaw } from "vue-router";
import PortalView from "@/views/portal/PortalView.vue";

export const MOBILE_MODULES = ["feed", "blog", "music", "books", "podcast", "video", "forum", "debate", "timeline"] as const;

export const mobileInitialRoutes: RouteRecordRaw[] = [
	{
		path: "/",
		component: PortalView,
		meta: { portalHome: true },
	},
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
