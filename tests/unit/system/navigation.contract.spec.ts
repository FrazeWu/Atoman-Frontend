import { readFileSync } from "node:fs";
import path from "node:path";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";

import {
	isRoomRouteActive,
	moduleRooms,
	notificationRoom,
	topbarNavOrder,
} from "../../../src/config/moduleRooms";
import { buildAppRoutes } from "../../../src/router/buildAppRoutes";
import {
	getMobileMoreItems,
	getMobilePrimaryTabs,
} from "../../../src/composables/useResponsiveShell";
import type { SiteContext } from "../../../src/router/siteContext";

const readSource = (relativePath: string) =>
	readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("application navigation contracts", () => {
	it("renders topbar navigation from the shared room config", () => {
		const source = readSource("src/components/system/AppTopbar.vue");

		expect(source).toContain('v-for="room in navRooms"');
		expect(source).toContain(
			"topbarNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key])",
		);
		expect(topbarNavOrder.map((key) => moduleRooms[key].name)).toEqual([
			"订阅",
			"博客",
			"音乐",
			"视频",
			"播客",
		]);
		expect(topbarNavOrder).not.toContain("media");
		for (const key of topbarNavOrder) {
			expect(moduleRooms[key].name.length).toBeLessThanOrEqual(3);
			expect(moduleRooms[key].helper.length).toBeGreaterThan(0);
		}
	});

	it("uses functional labels without retired navigation copy", () => {
		const source = readSource("src/components/system/AppTopbar.vue");
		const roomNames = Object.values(moduleRooms).map((room) => room.name);

		for (const retiredCopy of [
			"isBlogContext",
			"canCreatePost",
			"写文章",
			"发现",
			"ACCESS",
			"auth-kicker",
		]) {
			expect(source).not.toContain(retiredCopy);
		}
		expect(roomNames).not.toContain("山门");
		expect(roomNames).not.toContain("法堂");
		expect(notificationRoom).toMatchObject({
			name: "通知",
			helper: "通知与提醒",
		});
	});

	it("matches active rooms from site context instead of path prefixes", () => {
		const musicContext: SiteContext = { type: "module", module: "music" };
		const blogContext: SiteContext = { type: "module", module: "blog" };
		const portalContext: SiteContext = { type: "portal" };

		expect(isRoomRouteActive("music", musicContext)).toBe(true);
		expect(isRoomRouteActive("blog", musicContext)).toBe(false);
		expect(isRoomRouteActive("blog", blogContext)).toBe(true);
		expect(isRoomRouteActive("feed", portalContext)).toBe(false);
	});

	it("keeps every static mobile navigation target out of the 404 route", () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: buildAppRoutes(),
		});
		const moduleTargets = Object.keys(moduleRooms).flatMap((module) =>
				getMobilePrimaryTabs(module as keyof typeof moduleRooms).map(
					(tab) => tab.href,
				),
			);
		const switcherTargets = getMobileMoreItems().map((item) => item.href);
		const targets = [...moduleTargets, ...switcherTargets];

		for (const target of targets) {
			const matched = router.resolve(target).matched;
			expect(matched.length, target).toBeGreaterThan(0);
			expect(matched[matched.length - 1]?.path, target).not.toBe(
				"/:pathMatch(.*)*",
			);
		}

		expect(router.resolve("/books").matched.at(-1)?.path).toBe(
			"/:pathMatch(.*)*",
		);
	});

	it.each([
		[
			"blog",
			"src/views/blog/BlogLayout.vue",
			["/posts", "/posts/subscriptions", "/posts/bookmarks"],
			"/posts/manage",
		],
		[
			"video",
			"src/views/video/VideoLayout.vue",
			["/videos", "/videos/subscriptions", "/videos/favorites"],
			"/videos/creator",
		],
	] as const)(
		"keeps %s sidebar entries inside the module",
		(_moduleName, relativePath, routes, retiredRoute) => {
			const source = readSource(relativePath);

			expect(source).toContain("<PSidebar");
			for (const route of routes) {
				expect(source).toContain(`to="${route}"`);
			}
			expect(source).not.toContain(`to="${retiredRoute}"`);
		},
	);

	it("keeps the short-note entry and route under posts", async () => {
		const source = readSource("src/components/system/AppSidebar.vue");

		expect(source).not.toContain("label: '写短笺'");
		expect(source).toContain(
			"{ to: '/posts/notes', label: '短笺', icon: MessageSquare }",
		);

		const router = createRouter({
			history: createMemoryHistory(),
			routes: buildAppRoutes(),
		});
		await router.push("/posts/notes");
		expect(router.currentRoute.value.fullPath).toBe("/posts/notes");
	});

	it("does not render a standalone song entry in the music sidebar", () => {
		const source = readSource("src/components/system/AppSidebar.vue");

		expect(source).not.toContain(
			"{ to: modulePathUrl('music', '/songs'), label: '歌曲', icon: Search }",
		);
	});

	it("keeps retired Studio copy out of the podcast sidebar", () => {
		const source = readSource("src/views/podcast/PodcastLayout.vue");

		expect(source).not.toContain("Studio");
		expect(moduleRooms.podcast.name.length).toBeGreaterThan(0);
	});

	it("keeps timeline layout navigation inside the module", () => {
		const source = readSource("src/views/timeline/TimelineLayout.vue");

		expect(source).toContain('to="/timeline"');
		expect(source).toContain('to="/timeline/persons"');
		expect(source).not.toContain('to="/"');
		expect(source).not.toContain('to="/persons"');
	});

	it("opens person map pages under the timeline module", () => {
		const listSource = readSource("src/views/timeline/PersonListView.vue");
		const homeSource = readSource("src/views/timeline/TimelineHomeView.vue");
		const creationSource = readSource(
			"src/composables/timeline/useTimelinePersonCreation.ts",
		);

		expect(listSource).toContain(
			"router.push(`/timeline/person/${person.id}`)",
		);
		expect(listSource).toContain(
			"router.push(`/timeline/person/${created.id}`)",
		);
		expect(homeSource).toContain("useTimelinePersonCreation()");
		expect(creationSource).toContain(
			"router.push(`/timeline/person/${created.id}`)",
		);
	});

	it("returns from person maps to the timeline person list", () => {
		const source = readSource("src/views/timeline/PersonMapView.vue");

		expect(source).toContain('to="/timeline/persons"');
		expect(source).toContain("router.push('/timeline/persons')");
		expect(source).not.toContain('to="/persons"');
		expect(source).not.toContain("router.push('/persons')");
	});
});
