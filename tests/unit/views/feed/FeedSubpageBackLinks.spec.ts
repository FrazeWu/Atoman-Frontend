import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedItemDetailView from "../../../../src/views/feed/FeedItemDetailView.vue";
// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedStatsView from "../../../../src/views/feed/FeedStatsView.vue";

vi.mock("chart.js/auto", () => ({
	default: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("vue-router", () => ({
	RouterLink: {
		name: "RouterLink",
		props: ["to"],
		template: '<a :href="to"><slot /></a>',
	},
	useRoute: () => ({ params: { id: "feed-item-1" } }),
	useRouter: () => ({ push: vi.fn() }),
}));

const stubs = {
	PBadge: true,
	PEmpty: true,
	PContentCard: {
		props: ["title", "summary"],
		template: '<article><slot name="visual" /><slot name="meta" /></article>',
	},
	PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
	PPress: {
		props: ["label"],
		template: '<button type="button">{{ label }}</button>',
	},
	PTab: true,
};

describe("Feed subpage back links", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("renders the item-detail error state without restoring the legacy full-page article", async () => {
		const wrapper = mount(FeedItemDetailView, { global: { stubs } });

		await vi.waitFor(() => {
			expect(wrapper.findComponent({ name: "PEmpty" }).exists()).toBe(true);
		});
	});

	it("points stats back to the feed module root", async () => {
		const wrapper = mount(FeedStatsView, { global: { stubs } });

		await vi.waitFor(() => {
			const backLinks = wrapper
				.findAllComponents({ name: "RouterLink" })
				.filter(
					(link) =>
						link.text().includes("返回订阅") ||
						link.text().includes("BACK TO FEED"),
				);

			expect(backLinks).not.toHaveLength(0);
			expect(backLinks.every((link) => link.props("to") === "/feed")).toBe(
				true,
			);
		});
	});
});
