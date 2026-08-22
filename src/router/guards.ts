import type { Router } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useOnboardingStore } from "@/stores/onboarding";
import { useSiteAccessStore } from "@/stores/siteAccess";
import { resolveSiteContext } from "@/router/siteContext";
import { isAdminRole, isModeratorRole, isOwnerRole } from "@/utils/roles";

const disabledTarget = { path: "/__disabled__" };
const studioFeatureGates = {
	blog: { module: "blog", feature: "post.create" },
	podcast: { module: "podcast", feature: "podcast.publish" },
	video: { module: "video", feature: "video.publish" },
} as const;
const publicSystemPaths = new Set([
	"/login",
	"/register",
	"/auth/oauth/callback",
	"/auth/oauth/verify-email",
	"/auth/oauth/complete-profile",
	"/auth/oauth/confirm-account",
	"/auth/oauth/set-password",
	"/about",
	"/terms",
	"/privacy",
	"/__not_found__",
	disabledTarget.path,
]);

export function installRouteGuards(router: Router) {
	router.beforeEach(async (to, _from) => {
		const authStore = useAuthStore();
		const onboardingStore = useOnboardingStore();
		const siteAccessStore = useSiteAccessStore();
		const isSettingRoute = to.path === "/site/setting";
		const isPublicSystemRoute = publicSystemPaths.has(to.path);
		const requiresMusicEditorAuth =
			to.path === "/music" &&
			(to.query.editor === "artist-create" || to.query.editor === "album-edit");
		const requiresAuth =
			Boolean(to.meta.requiresAuth) || requiresMusicEditorAuth;
		const hasValidSession =
			authStore.validateSession() ||
			(requiresAuth ? await authStore.restoreSession() : false);

		if (hasValidSession) {
			onboardingStore.initialize(authStore.user);
		} else {
			onboardingStore.reset();
		}

		if (
			!isSettingRoute &&
			!isPublicSystemRoute &&
			!siteAccessStore.loaded &&
			!siteAccessStore.loading
		) {
			try {
				await siteAccessStore.load();
			} catch {
				// Fail open with the default access config so a transient settings API
				// failure does not make the whole site unreachable.
			}
		}

		if (requiresAuth && !hasValidSession) {
			return { path: "/login", query: { redirect: to.fullPath } };
		}

		if (to.meta.requiresModerator && !isModeratorRole(authStore.user?.role)) {
			return "/";
		}
		if (to.meta.requiresAdmin && !isAdminRole(authStore.user?.role)) {
			return "/";
		}
		if (to.meta.requiresOwner && !isOwnerRole(authStore.user?.role)) {
			return "/site/setting";
		}

		if (!isSettingRoute && !isPublicSystemRoute) {
			const targetUrl = new URL(to.fullPath, window.location.origin);
			const context = resolveSiteContext(
				window.location.hostname,
				targetUrl.search,
				to.path,
			);
			if (
				context.type === "module" &&
				!siteAccessStore.isModuleVisible(context.module)
			) {
				return disabledTarget;
			}
		}

		const configuredFeatureGate = to.meta.featureGate as
			| {
					module: Parameters<typeof siteAccessStore.isFeatureEnabled>[0];
					feature: Parameters<typeof siteAccessStore.isFeatureEnabled>[1];
			  }
			| undefined;
		const studioModule = String(to.params.module);
		const studioFeatureGate =
			to.meta.studioOverlay && studioModule in studioFeatureGates
				? studioFeatureGates[studioModule as keyof typeof studioFeatureGates]
				: undefined;
		const featureGate = configuredFeatureGate ?? studioFeatureGate;
		if (
			!isSettingRoute &&
			!isPublicSystemRoute &&
			featureGate &&
			!siteAccessStore.isFeatureEnabled(featureGate.module, featureGate.feature)
		) {
			return disabledTarget;
		}
	});
}
