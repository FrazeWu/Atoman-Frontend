import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";

// @ts-expect-error Vue SFC modules are resolved by the Vitest Vite plugin.
import StudioModuleLayout from "../../../../src/views/studio/StudioModuleLayout.vue";
// @ts-expect-error Vue SFC modules are resolved by the Vitest Vite plugin.
import StudioRouteSheet from "../../../../src/components/studio/StudioRouteSheet.vue";

const BaseContent = { template: '<div data-testid="studio-base-content" />' };
const EditorContent = {
	template: '<div data-testid="studio-editor-content" />',
};

const routes = [
	{
		path: "/studio/:module",
		component: StudioModuleLayout,
		children: [
			{
				path: "new",
				components: {
					default: BaseContent,
					overlay: EditorContent,
				},
				meta: {
					studioOverlay: true,
					studioOverlayMode: "new",
					studioOverlayTitle: "新建博客",
				},
			},
			{
				path: "content",
				component: BaseContent,
			},
		],
	},
];

describe("StudioModuleLayout overlay", () => {
	it("keeps the base content while rendering an editor route in a sheet", async () => {
		const router = createRouter({ history: createMemoryHistory(), routes });
		await router.push("/studio/blog/new");
		await router.isReady();

		const wrapper = mount(StudioModuleLayout, {
			global: { plugins: [router] },
		});
		await flushPromises();

		expect(wrapper.find('[data-testid="studio-base-content"]').exists()).toBe(
			true,
		);
		expect(wrapper.find('[data-testid="studio-editor-content"]').exists()).toBe(
			true,
		);
		expect(wrapper.findComponent(StudioRouteSheet).exists()).toBe(true);
		expect(wrapper.findComponent(StudioRouteSheet).props("title")).toBe(
			"新建-文章",
		);

		wrapper.findComponent(EditorContent).vm.$emit("title-change", "新文章");
		await wrapper.vm.$nextTick();
		expect(wrapper.findComponent(StudioRouteSheet).props("title")).toBe(
			"新建-新文章",
		);
	});

	it("falls back to module content when a deep link has no app history", async () => {
		const router = createRouter({ history: createMemoryHistory(), routes });
		await router.push("/studio/blog/new?collection=collection-1");
		await router.isReady();

		const wrapper = mount(StudioModuleLayout, {
			global: { plugins: [router] },
		});
		await flushPromises();

		wrapper.findComponent(StudioRouteSheet).vm.$emit("close");
		await flushPromises();

		expect(router.currentRoute.value.fullPath).toBe(
			"/studio/blog/content?collection_id=collection-1",
		);
	});
});
