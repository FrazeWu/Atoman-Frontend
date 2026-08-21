/// <reference types="vite/client" />
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error Vue SFC modules are resolved by the Vitest Vite plugin.
import StudioCollectionManager from "../../../../src/components/studio/StudioCollectionManager.vue";
import { useStudioStore } from "../../../../src/stores/studio";
const PModal = {
	props: ["modelValue"],
	template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
};

describe("StudioCollectionManager", () => {
	it("creates renames and deletes unified collections", async () => {
		const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
		const store = useStudioStore(pinia);
		store.unifiedCollections = [
			{
				id: "collection-1",
				channel_id: "channel-1",
				content_type: "blog",
				name: "旧名称",
				description: "旧描述",
				cover_url: "",
				is_default: false,
				created_at: "",
				updated_at: "",
			},
		];
		const wrapper = mount(StudioCollectionManager, {
			props: { module: "blog" },
			global: { plugins: [pinia], stubs: { PModal } },
		});

		await wrapper.find('[data-testid="new-collection"]').trigger("click");
		await wrapper.find('[data-testid="collection-name"]').setValue("新合集");
		await wrapper
			.find('[data-testid="collection-description"]')
			.setValue("新描述");
		await wrapper.find('[data-testid="save-collection"]').trigger("click");
		await flushPromises();
		expect(store.createUnifiedCollection).toHaveBeenCalledWith({
			name: "新合集",
			description: "新描述",
		});

		await wrapper
			.find('[data-testid="edit-collection-collection-1"]')
			.trigger("click");
		await wrapper.find('[data-testid="collection-name"]').setValue("新名称");
		await wrapper.find('[data-testid="save-collection"]').trigger("click");
		await flushPromises();
		expect(store.updateUnifiedCollection).toHaveBeenCalledWith("collection-1", {
			name: "新名称",
			description: "旧描述",
		});

		await wrapper
			.find('[data-testid="delete-collection-collection-1"]')
			.trigger("click");
		await wrapper
			.find('[data-testid="confirm-delete-collection"]')
			.trigger("click");
		await flushPromises();
		expect(store.deleteUnifiedCollection).toHaveBeenCalledWith("collection-1");
	});

	it("keeps the default collection visible without a delete action", () => {
		const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
		const store = useStudioStore(pinia);
		store.unifiedCollections = [
			{
				id: "collection-default",
				channel_id: "channel-1",
				content_type: "blog",
				name: "全部文章",
				description: "",
				cover_url: "",
				is_default: true,
				created_at: "",
				updated_at: "",
			},
		];

		const wrapper = mount(StudioCollectionManager, {
			global: { plugins: [pinia], stubs: { PModal } },
		});

		expect(wrapper.text()).toContain("默认合集");
		expect(
			wrapper
				.find('[data-testid="delete-collection-collection-default"]')
				.exists(),
		).toBe(false);
	});

	it("cancels an active edit", async () => {
		const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
		const store = useStudioStore(pinia);
		store.unifiedCollections = [
			{
				id: "collection-1",
				channel_id: "channel-1",
				content_type: "blog",
				name: "博客合集",
				description: "",
				cover_url: "",
				is_default: false,
				created_at: "",
				updated_at: "",
			},
		];
		const wrapper = mount(StudioCollectionManager, {
			props: { module: "blog" },
			global: { plugins: [pinia], stubs: { PModal } },
		});

		await wrapper
			.find('[data-testid="edit-collection-collection-1"]')
			.trigger("click");
		expect(wrapper.find('[data-testid="collection-name"]').exists()).toBe(true);

		await wrapper.find('[data-testid="cancel-collection"]').trigger("click");
		expect(wrapper.find('[data-testid="collection-name"]').exists()).toBe(
			false,
		);
	});
});
