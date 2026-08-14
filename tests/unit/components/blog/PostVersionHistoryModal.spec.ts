import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vue test files are outside the app tsconfig shim scope.
import PostVersionHistoryModal from "../../../../src/components/blog/PostVersionHistoryModal.vue";
import { useAuthStore } from "../../../../src/stores/auth";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

describe("PostVersionHistoryModal", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useAuthStore().token = "token";
	});

	it("loads versions and restores the selected version", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (
					url.endsWith("/blog/posts/post-1/versions") &&
					(!init?.method || init.method === "GET")
				) {
					return jsonResponse({
						data: [
							{
								id: "version-id",
								post_id: "post-1",
								version: 2,
								editor_id: "user-1",
								title: "第二版",
								content: "正文",
								visibility: "public",
								collection_id: "collection-1",
								created_at: "2026-07-01T12:00:00Z",
								updated_at: "2026-07-01T12:00:00Z",
							},
						],
					});
				}
				if (
					url.endsWith("/blog/posts/post-1/versions/2/restore") &&
					init?.method === "POST"
				) {
					return jsonResponse({ data: { id: "post-1" } });
				}
				throw new Error(`unexpected request: ${url}`);
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		const wrapper = mount(PostVersionHistoryModal, {
			props: { postId: "post-1" },
			global: { stubs: { teleport: true } },
		});
		await flushPromises();

		expect(wrapper.text()).toContain("版本 2 · 第二版");
		await wrapper.get("button:not(.p-modal-close-floating)").trigger("click");
		await flushPromises();

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/blog/posts/post-1/versions/2/restore"),
			expect.objectContaining({ method: "POST" }),
		);
		expect(wrapper.emitted("restored")).toHaveLength(1);
	});
});
