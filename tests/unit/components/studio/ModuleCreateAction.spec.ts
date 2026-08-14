/// <reference types="vite/client" />
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error Vue SFC modules are resolved by the Vitest Vite plugin.
import ModuleCreateAction from "../../../../src/components/studio/ModuleCreateAction.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useSiteAccessStore } from "../../../../src/stores/siteAccess";
import type { StudioModule } from "../../../../src/types";

const cases = [
	{
		module: "blog",
		label: "写博客",
		to: "/studio/blog/new",
		feature: "post.create",
	},
	{
		module: "podcast",
		label: "上传播客",
		to: "/studio/podcast/new",
		feature: "podcast.publish",
	},
	{
		module: "video",
		label: "上传视频",
		to: "/studio/video/new",
		feature: "video.publish",
	},
] as const;

async function mountAction(
	module: StudioModule,
	authenticated = true,
	enabled = true,
) {
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
	const auth = useAuthStore(pinia);
	auth.isAuthenticated = authenticated;
	auth.user = authenticated
		? {
				id: 1,
				uuid: "user-1",
				username: "creator",
				email: "creator@example.com",
				role: "user",
			}
		: null;
	const siteAccess = useSiteAccessStore(pinia);
	siteAccess.isFeatureEnabled = vi.fn().mockReturnValue(enabled);
	const router = createRouter({
		history: createMemoryHistory(),
		routes: cases.map((item) => ({
			path: item.to,
			component: { template: "<div />" },
		})),
	});
	await router.push("/");
	await router.isReady();

	return {
		wrapper: mount(ModuleCreateAction, {
			props: { module },
			global: { plugins: [pinia, router] },
		}),
		siteAccess,
	};
}

describe("ModuleCreateAction", () => {
	it.each(cases)(
		"links $module to its Studio creation page",
		async ({ module, label, to, feature }) => {
			const { wrapper, siteAccess } = await mountAction(module);
			const link = wrapper.get(`[data-testid="module-create-${module}"]`);

			expect(link.text()).toContain(label);
			expect(link.attributes("href")).toBe(to);
			expect(siteAccess.isFeatureEnabled).toHaveBeenCalledWith(module, feature);
		},
	);

	it("stays hidden for guests and disabled publishing features", async () => {
		const guest = await mountAction("blog", false);
		const disabled = await mountAction("video", true, false);

		expect(
			guest.wrapper.find('[data-testid="module-create-blog"]').exists(),
		).toBe(false);
		expect(
			disabled.wrapper.find('[data-testid="module-create-video"]').exists(),
		).toBe(false);
	});
});
