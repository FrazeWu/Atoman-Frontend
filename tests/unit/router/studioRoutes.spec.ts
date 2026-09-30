import type { RouteLocation, RouteRecordRaw } from "vue-router";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";

import { buildAppRoutes } from "../../../src/router/buildAppRoutes";
import { studioRoutes } from "../../../src/router/routes/studio";

function routePaths(routes: RouteRecordRaw[], parent = ""): string[] {
	return routes.flatMap((route) => {
		const path = route.path.startsWith("/")
			? route.path
			: `${parent.replace(/\/$/, "")}/${route.path}`.replace(/\/$/, "");
		return [path || "/", ...routePaths(route.children ?? [], path)];
	});
}

describe("studio routes", () => {
	it("provides one authenticated creator workspace with module pages and editors", () => {
		const paths = routePaths(studioRoutes);
		expect(studioRoutes).toHaveLength(1);
		expect(studioRoutes[0]?.path).toBe("/studio");
		expect(studioRoutes[0]?.meta?.requiresAuth).toBe(true);
		expect(paths).toEqual(
			expect.arrayContaining([
				"/studio",
				"/studio/manage",
				"/studio/manage/channel",
				"/studio/manage/calendar",
				"/studio/manage/goals",
				"/studio/manage/collections",
				"/studio/manage/collections/:id",
				"/studio/channel",
				"/studio/:module(blog|podcast|video)/content",
				"/studio/:module(blog|podcast|video)/collections",
				"/studio/:module(blog|podcast|video)/analytics",
				"/studio/:module(blog|podcast|video)/interactions",
				"/studio/:module(blog|podcast|video)/settings",
				"/studio/:module(blog|podcast|video)/new",
				"/studio/:module(blog|podcast|video)/:id/edit",
			]),
		);
	});

	it("redirects channel and module collection legacy URLs into management", () => {
		const studio = studioRoutes[0];
		const moduleRoute = studio?.children?.find(
			(route) => route.path === ":module(blog|podcast|video)",
		);
		const channelCollectionsRoute = studio?.children?.find(
			(route) => route.name === "studio-channel-collections",
		);
		const moduleCollectionsRoute = moduleRoute?.children?.find(
			(route) => route.path === "collections",
		);

		if (
			typeof channelCollectionsRoute?.redirect !== "function" ||
			typeof moduleCollectionsRoute?.redirect !== "function"
		) {
			throw new Error("创作中心合集旧路由缺少重定向");
		}

		const channelRedirect = channelCollectionsRoute.redirect({
			query: { source: "legacy" },
			hash: "#collections",
		} as RouteLocation);
		expect(channelRedirect).toEqual({
			path: "/studio/manage/collections",
			query: { source: "legacy" },
			hash: "#collections",
		});

		expect(moduleCollectionsRoute.redirect({} as RouteLocation)).toEqual({
			path: "/studio/manage/collections",
		});
	});

	it("keeps the module parent mounted while adding an editor overlay", () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: buildAppRoutes(),
		});
		const contentRoute = router.resolve("/studio/blog/content");
		const editorRoute = router.resolve("/studio/blog/new");
		const moduleParent = contentRoute.matched[1];
		const contentView = contentRoute.matched[2]?.components?.default;

		expect(editorRoute.matched[1]).toBe(moduleParent);
		expect(editorRoute.name).toBe("studio-content-new");
		expect(editorRoute.matched[2]?.components?.default).toBe(
			contentView,
		);
		expect(
			editorRoute.matched[2]?.components?.overlay,
		).toBeDefined();
	});

	it("resolves every editor URL through the shared module route", () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: buildAppRoutes(),
		});
		for (const path of [
			"/studio/blog/new",
			"/studio/blog/post-1/edit",
			"/studio/podcast/new",
			"/studio/podcast/episode-1/edit",
			"/studio/video/new",
			"/studio/video/video-1/edit",
		]) {
			expect(router.resolve(path).name).toMatch(/^studio-content-(new|edit)$/);
		}
	});

	it("removes every legacy creator route from the application", () => {
		const paths = routePaths(buildAppRoutes());
		for (const legacy of [
			"/posts/manage",
			"/posts/post/new",
			"/posts/post/:id/edit",
			"/podcasts/creator",
			"/podcasts/editor/:id?",
			"/videos/creator",
			"/videos/manage",
			"/videos/upload",
			"/videos/edit/:id",
			"/channels",
		]) {
			expect(paths).not.toContain(legacy);
		}
	});

	it("does not treat the retired blog editor path as a public post id", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: buildAppRoutes(),
		});
		await router.push("/posts/post/new");
		expect(router.currentRoute.value.path).toBe("/__not_found__");
	});
});
