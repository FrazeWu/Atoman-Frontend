import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error The isolated test TS project does not load Vue's SFC shim.
import MobileModuleDirectoryView from "../../../apps/mobile/MobileModuleDirectoryView.vue";
// @ts-expect-error The isolated test TS project does not load Vue's SFC shim.
import MobileModuleSwitcher from "../../../src/components/system/MobileModuleSwitcher.vue";

function createTestRouter() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/modules", component: { template: "<div />" } },
			{ path: "/feed", component: { template: "<div />" } },
			{ path: "/posts", component: { template: "<div />" } },
			{ path: "/music", component: { template: "<div />" } },
			{ path: "/inbox", component: { template: "<div />" } },
			{ path: "/studio", component: { template: "<div />" } },
			{ path: "/login", component: { template: "<div />" } },
		],
	});
}

describe("MobileModuleSwitcher", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("uses a native route instead of opening a module sheet", async () => {
		const router = createTestRouter();
		await router.push("/music");
		await router.isReady();

		const wrapper = mount(MobileModuleSwitcher, {
			props: { label: "音乐", currentModule: "music" },
			global: { plugins: [router] },
		});

		const link = wrapper.get('[data-testid="mobile-module-switcher"]');
		expect(link.element.tagName).toBe("A");
		expect(link.attributes("href")).toBe("/modules");
		expect(wrapper.find('[data-testid="mobile-module-sheet"]').exists()).toBe(
			false,
		);
	});

	it("renders mobile modules and personal entries as grouped page links", async () => {
		const router = createTestRouter();
		await router.push("/modules");
		await router.isReady();

		const wrapper = mount(MobileModuleDirectoryView, {
			global: { plugins: [router] },
		});

		expect(wrapper.text()).toContain("订阅");
		expect(wrapper.text()).toContain("博客");
		expect(wrapper.text()).toContain("音乐");
		expect(wrapper.text()).toContain("通知");
		expect(wrapper.text()).toContain("私信");
		expect(wrapper.text()).toContain("Studio");
		expect(wrapper.findAll('a[href="/inbox?tab=notifications"]').length).toBe(
			1,
		);
		expect(wrapper.findAll('a[href="/inbox?tab=dm"]').length).toBe(1);
		expect(wrapper.findAll('a[href="/studio"]').length).toBe(1);
	});
});
