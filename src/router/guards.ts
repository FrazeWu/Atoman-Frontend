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
	"/forgot-password",
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
const guestOnlyPaths = new Set(["/login", "/register", "/forgot-password"]);

function resolveGuestRedirect(value: unknown) {
	if (typeof value !== "string") return "/feed";
	if (!value.startsWith("/") || value.startsWith("//")) return "/feed";
	if (/[^\x20-\x7E]/.test(value)) return "/feed";
	const pathname = value.split(/[?#]/, 1)[0];
	return guestOnlyPaths.has(pathname) ? "/feed" : value;
}

export function installRouteGuards(router: Router) {
	router.beforeEach(async (to, _from) => {
		const authStore = useAuthStore();
		const onboardingStore = useOnboardingStore();
		const siteAccessStore = useSiteAccessStore();
		const isSettingRoute =
			to.path === "/site/setting" || to.path.startsWith("/site/setting/");
		const isPublicSystemRoute = publicSystemPaths.has(to.path);
		const isGuestOnlyRoute = Boolean(to.meta.guestOnly);
		const requiresMusicEditorAuth =
			to.path === "/music" &&
			(to.query.editor === "artist-create" || to.query.editor === "album-edit");
		const requiresAuth = Boolean(to.meta.requiresAuth) || requiresMusicEditorAuth;
		const hasValidSession =
			authStore.validateSession() ||
			(requiresAuth || isGuestOnlyRoute ? await authStore.restoreSession() : false);

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

		if (isGuestOnlyRoute && hasValidSession) {
			return resolveGuestRedirect(to.query.redirect);
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
