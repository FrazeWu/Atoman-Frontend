import { flushPromises } from "@vue/test-utils";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
// @ts-expect-error The isolated test TS project does not load Vue's SFC shim.
import MobileBottomNav from "../../../src/components/system/MobileBottomNav.vue";
import {
	getMobileMoreItems,
	getMobilePrimaryTabs,
	type MobileMoreItem,
	type MobilePrimaryTab,
} from "../../../src/composables/useResponsiveShell";

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/music", component: { template: "<div />" } },
			{ path: "/music/discover", component: { template: "<div />" } },
			{ path: "/music/songs", component: { template: "<div />" } },
			{ path: "/music/playlists", component: { template: "<div />" } },
			{ path: "/music/bookmarks", component: { template: "<div />" } },
			{ path: "/music/me", component: { template: "<div />" } },
			{ path: "/music/more", component: { template: "<div />" } },
		],
	});

describe("useResponsiveShell", () => {
	it("returns the stable tabs for each module context", () => {
		expect(
			getMobilePrimaryTabs("music").map((tab: MobilePrimaryTab) => tab.label),
		).toEqual(["发现", "搜索", "歌单", "我的", "更多"]);
		expect(
			getMobilePrimaryTabs("forum").map((tab: MobilePrimaryTab) => tab.label),
		).toEqual(["话题", "分类", "搜索", "我的"]);
		expect(
			getMobilePrimaryTabs("debate").map((tab: MobilePrimaryTab) => tab.label),
		).toEqual(["辩题", "搜索", "我的"]);
		expect(
			getMobilePrimaryTabs("timeline").map(
				(tab: MobilePrimaryTab) => tab.label,
			),
		).toEqual(["时间轴", "人物", "搜索", "我的"]);
		expect(
			getMobilePrimaryTabs("podcast").map((tab: MobilePrimaryTab) => tab.label),
		).toEqual(["发现", "播放列表", "订阅", "我的"]);
		expect(
			getMobilePrimaryTabs("video").map((tab: MobilePrimaryTab) => tab.label),
		).toEqual(["发现", "搜索", "订阅", "收藏"]);
	});

	it("keeps available modules in the module switcher collection", () => {
		const items = getMobileMoreItems();
		const modules = items.map((item: MobileMoreItem) => item.module);
		expect(modules).toEqual([
			"feed",
			"blog",
			"music",
			"forum",
			"debate",
			"timeline",
			"podcast",
			"video",
		]);
	});

	it("returns defensive copies for tab and switcher collections", () => {
		const firstTabs = getMobilePrimaryTabs("music");
		const secondTabs = getMobilePrimaryTabs("music");
		const firstItems = getMobileMoreItems();
		const secondItems = getMobileMoreItems();

		expect(firstTabs).not.toBe(secondTabs);
		expect(firstTabs[0]).not.toBe(secondTabs[0]);
		expect(firstItems).not.toBe(secondItems);
		expect(firstItems[0]).not.toBe(secondItems[0]);

		firstTabs[0]!.label = "changed";
		firstItems[0]!.label = "changed";
		expect(secondTabs[0]?.label).toBe("发现");
		expect(secondItems[0]?.label).toBe("订阅");
	});

	it("renders only the current module tabs and marks the active route", async () => {
		const router = makeRouter();
		await router.push("/music");
		await router.isReady();
		const wrapper = mount(MobileBottomNav, { global: { plugins: [router] } });

		expect(
			wrapper
				.findAll('[data-testid="mobile-bottom-nav-tab"]')
				.map((tab) => tab.text()),
		).toEqual(["发现", "搜索", "歌单", "我的", "更多"]);
		expect(wrapper.get('[data-tab-key="discover"]').classes()).toContain(
			"is-active",
		);

		await router.push("/music/songs");
		await wrapper.vm.$nextTick();
		expect(wrapper.get('[data-tab-key="search"]').classes()).toContain(
			"is-active",
		);
	});

	it("navigates to a module tab target without opening a global more menu", async () => {
		const router = makeRouter();
		await router.push("/music");
		await router.isReady();
		const wrapper = mount(MobileBottomNav, { global: { plugins: [router] } });

		await wrapper.get('[data-tab-key="library"]').trigger("click");
		await flushPromises();
		expect(router.currentRoute.value.path).toBe("/music/playlists");
		expect(wrapper.find('[data-testid="mobile-more-sheet"]').exists()).toBe(
			false,
		);
	});

	it("does not render module tabs for the portal context", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/", component: { template: "<div />" } }],
		});
		await router.push("/");
		await router.isReady();
		const wrapper = mount(MobileBottomNav, { global: { plugins: [router] } });
		expect(wrapper.find('[data-testid="mobile-bottom-nav-tab"]').exists()).toBe(
			false,
		);
	});
});
