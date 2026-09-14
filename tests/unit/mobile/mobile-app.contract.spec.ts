import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error Vue SFC resolution is provided by vue-tsc and Vitest.
import PortalView from "../../../src/views/portal/PortalView.vue";
import {
	mobileRoutes,
	MOBILE_MODULES,
} from "../../../apps/mobile/mobileRoutes";

const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const mobileIndexHtml = readFileSync(
	resolve(process.cwd(), "apps/mobile/index.html"),
	"utf8",
);
const mobileAppSource = readFileSync(
	resolve(process.cwd(), "apps/mobile/MobileApp.vue"),
	"utf8",
);
const portalSource = readFileSync(
	resolve(process.cwd(), "src/views/portal/PortalView.vue"),
	"utf8",
);

function routePaths(routes = mobileRoutes, parentPath = ""): string[] {
	return routes.flatMap((route) => {
		const path =
			route.path === ""
				? parentPath || "/"
				: route.path.startsWith("/")
					? route.path
					: `${parentPath}/${route.path}`;
		return [path, ...(route.children ? routePaths(route.children, path) : [])];
	});
}

describe("mobile app route boundary", () => {
	it("starts at the portal homepage and exposes only the pilot modules", () => {
		const homeRoute = mobileRoutes[0];
		expect(homeRoute).toMatchObject({ path: "/" });
		expect(homeRoute).not.toHaveProperty("redirect");
		expect(homeRoute?.component).toBe(PortalView);
		expect(MOBILE_MODULES).toEqual(["feed", "blog", "music"]);
	});

	it("keeps the pilot module routes available for deep links", () => {
		expect(routePaths()).toEqual(
			expect.arrayContaining([
				"/modules",
				"/inbox",
				"/studio",
				"/studio/:module(blog|podcast|video)/content",
				"/studio/:module(blog|podcast|video)/:id/edit",
				"/posts/notes/:id/edit",
				"/feed",
				"/feed/sources",
				"/feed/subscriptions",
				"/feed/reading-list",
				"/feed/starred",
				"/feed/item/:id",
				"/posts",
				"/posts/notes",
				"/posts/subscriptions",
				"/posts/bookmarks",
				"/post/:id",
				"/posts/post/:id",
				"/channel/:slug",
				"/posts/channel/:slug",
				"/channels/:slug",
				"/users/:handle",
				"/users/:handle/posts",
				"/users/:handle/channels",
				"/users/:handle/settings",
				"/collection/:id",
				"/music",
				"/music/tags",
				"/music/tags/:tagId",
				"/music/player",
				"/music/lyrics",
				"/music/playlists",
				"/music/bookmarks",
				"/music/me",
				"/videos/watch/:id",
			]),
		);
	});

	it("keeps Studio and personal routes outside the bottom-navigation modules", () => {
		expect(MOBILE_MODULES).not.toContain("studio");
		expect(routePaths()).toContain("/studio");
		expect(routePaths()).toContain("/inbox");
	});

	it("does not advertise modules that are not in the pilot", () => {
		expect(routePaths()).not.toContain("/forum");
	});

	it("enables viewport-fit=cover so safe-area insets work for fixed mobile chrome", () => {
		expect(indexHtml).toMatch(
			/<meta\s+name="viewport"\s+content="[^"]*viewport-fit=cover[^"]*"\s*\/?>/,
		);
	});

	it("defers analytics loading until the app scheduler runs", () => {
		expect(mobileIndexHtml).not.toContain("googletagmanager.com/gtag/js");
		expect(mobileIndexHtml).not.toContain("G-1FLNTZ469W");
		expect(mobileAppSource).toContain("scheduleGoogleAnalytics");
	});

	it("keeps the portal debate tag text at accessible contrast", () => {
		expect(portalSource).toContain("color: #3730a3;");
		expect(portalSource).not.toContain("color: #4f46e5;");
	});
});
