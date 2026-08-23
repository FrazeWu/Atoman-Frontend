import { describe, expect, it } from "vitest";
import {
	mobileRoutes,
	MOBILE_MODULES,
} from "../../../apps/mobile/mobileRoutes";

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
	it("starts at Feed and exposes only the pilot modules", () => {
		expect(mobileRoutes[0]).toMatchObject({ path: "/", redirect: "/feed" });
		expect(MOBILE_MODULES).toEqual(["feed", "blog", "music"]);
	});

	it("keeps the pilot module routes available for deep links", () => {
		expect(routePaths()).toEqual(
			expect.arrayContaining([
				"/feed",
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
				"/collection/:id",
				"/music",
				"/music/player",
				"/music/bookmarks",
				"/music/me",
			]),
		);
	});

	it("does not advertise modules that are not in the pilot", () => {
		expect(routePaths()).not.toContain("/forum");
		expect(routePaths()).not.toContain("/studio");
	});
});
