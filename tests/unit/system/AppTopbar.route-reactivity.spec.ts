import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error The isolated test TS project does not load Vue's SFC shim.
import AppTopbar from "@/components/system/AppTopbar.vue";

const makeRouter = async () => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: { template: "<div />" } },
			{ path: "/feed", component: { template: "<div />" } },
			{ path: "/music", component: { template: "<div />" } },
			{ path: "/music/song/:id", component: { template: "<div />" } },
			{ path: "/studio/video/content", component: { template: "<div />" } },
			{ path: "/login", component: { template: "<div />" } },
		],
	});

	await router.push("/feed");
	await router.isReady();
	return router;
};

const activeNavText = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll(".nav-link.active").map((link) => link.text());

describe("AppTopbar route reactivity", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("updates the active room after SPA navigation changes route path", async () => {
		const router = await makeRouter();
		const wrapper = mount(AppTopbar, {
			global: {
				plugins: [router],
			},
		});

		expect(activeNavText(wrapper)).toEqual(["订阅"]);

		await router.push("/music");
		await flushPromises();

		expect(activeNavText(wrapper)).toEqual(["音乐"]);
	});

	it("navigates the ATOMAN brand to the portal root", async () => {
		const router = await makeRouter();
		await router.push("/music");

		const wrapper = mount(AppTopbar, {
			global: {
				plugins: [router],
			},
		});

		await wrapper.get(".brand-logo-link").trigger("click");
		await flushPromises();

		expect(router.currentRoute.value.path).toBe("/");
	});

	it("shows a mobile detail back action while retaining the module context", async () => {
		const router = await makeRouter();
		await router.push("/music/song/track-1");
		const wrapper = mount(AppTopbar, {
			global: {
				plugins: [router],
			},
		});

		expect(wrapper.find('[data-testid="mobile-back-button"]').exists()).toBe(
			true,
		);
		expect(
			wrapper.get('[data-testid="mobile-module-switcher"]').text(),
		).toContain("音乐");

		await wrapper.get('[data-testid="mobile-back-button"]').trigger("click");
		await flushPromises();
		expect(router.currentRoute.value.path).toBe("/music");
	});

	it("does not activate subscriptions inside Studio", async () => {
		const router = await makeRouter();
		await router.push("/studio/video/content");
		const wrapper = mount(AppTopbar, { global: { plugins: [router] } });

		expect(activeNavText(wrapper)).toEqual([]);
	});

	it("expands the bottom line after the main content scrolls", async () => {
		const router = await makeRouter();
		const wrapper = mount(AppTopbar, {
			global: {
				plugins: [router],
			},
		});
		const mainContent = document.createElement("main");
		mainContent.className = "a-main-content";
		document.body.append(mainContent);

		expect(wrapper.get(".topbar").classes()).not.toContain("is-scrolled");

		mainContent.scrollTop = 24;
		mainContent.dispatchEvent(new Event("scroll", { bubbles: true }));
		await wrapper.vm.$nextTick();

		expect(wrapper.get(".topbar").classes()).toContain("is-scrolled");

		mainContent.remove();
		wrapper.unmount();
	});
});
