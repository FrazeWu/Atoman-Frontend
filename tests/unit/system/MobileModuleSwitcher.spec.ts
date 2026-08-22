import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error The isolated test TS project does not load Vue's SFC shim.
import MobileModuleSwitcher from "../../../src/components/system/MobileModuleSwitcher.vue";
import { useSiteAccessStore } from "../../../src/stores/siteAccess";

const { navigateModuleWithShutter } = vi.hoisted(() => ({
	navigateModuleWithShutter: vi.fn(),
}));

vi.mock("@/composables/useAsyncNavigate", () => ({
	useAsyncNavigate: () => ({ navigateModuleWithShutter }),
}));

describe("MobileModuleSwitcher", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		navigateModuleWithShutter.mockReset();
	});

	it("shows the current module and all module entries in a sheet", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/music", component: { template: "<div />" } }],
		});
		await router.push("/music");
		await router.isReady();

		const wrapper = mount(MobileModuleSwitcher, {
			props: { label: "音乐", currentModule: "music" },
			global: {
				plugins: [router],
				stubs: {
					PSheet: {
						props: ["show"],
						template: '<div v-if="show"><slot /></div>',
					},
				},
			},
		});

		expect(
			wrapper.get('[data-testid="mobile-module-switcher"]').text(),
		).toContain("音乐");
		expect(wrapper.find('[data-testid="mobile-module-sheet"]').exists()).toBe(
			false,
		);

		await wrapper
			.get('[data-testid="mobile-module-switcher"]')
			.trigger("click");
		expect(wrapper.get('[data-testid="mobile-module-sheet"]').text()).toContain(
			"论坛",
		);
		expect(wrapper.get('[data-testid="mobile-module-sheet"]').text()).toContain(
			"Studio",
		);
		expect(
			wrapper.get(".mobile-module-sheet__item.is-current").text(),
		).toContain("音乐");
	});

	it("hides disabled modules from the module sheet", async () => {
		const siteAccessStore = useSiteAccessStore();
		siteAccessStore.access.modules.video.enabled = false;

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/music", component: { template: "<div />" } }],
		});
		await router.push("/music");
		await router.isReady();

		const wrapper = mount(MobileModuleSwitcher, {
			props: { label: "音乐", currentModule: "music" },
			global: {
				plugins: [router],
				stubs: {
					PSheet: {
						props: ["show"],
						template: '<div v-if="show"><slot /></div>',
					},
				},
			},
		});

		await wrapper
			.get('[data-testid="mobile-module-switcher"]')
			.trigger("click");
		expect(
			wrapper.get('[data-testid="mobile-module-sheet"]').text(),
		).not.toContain("视频");
	});

	it("uses the shutter navigation when selecting another module", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/music", component: { template: "<div />" } }],
		});
		await router.push("/music");
		await router.isReady();

		const wrapper = mount(MobileModuleSwitcher, {
			props: { label: "音乐", currentModule: "music" },
			global: {
				plugins: [router],
				stubs: {
					PSheet: {
						props: ["show"],
						template: '<div v-if="show"><slot /></div>',
					},
				},
			},
		});

		await wrapper
			.get('[data-testid="mobile-module-switcher"]')
			.trigger("click");
		await wrapper.get(".mobile-module-sheet__item").trigger("click");
		await flushPromises();
		expect(navigateModuleWithShutter).toHaveBeenCalledWith("/feed");
	});
});
