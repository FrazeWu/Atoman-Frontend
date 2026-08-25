import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

const apiRequestResult = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => ({ apiRequestResult }));
vi.mock("@/composables/useApi", () => ({ useApi: () => ({ url: "/api/v1" }) }));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ isAuthenticated: true, token: "feed-token" }),
}));

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedContentFeedback from "@/components/feed/FeedContentFeedback.vue";

const PDropdownStub = defineComponent({
  setup(_, { slots }) {
    return () => [slots.trigger?.(), slots.default?.({ close: vi.fn() })];
  },
});

function mountFeedback(
  itemId = "item-1",
  variant: "rss" | "full_text" | "summary" = "rss",
) {
  return mount(FeedContentFeedback, {
    props: { itemId, variant },
    global: { stubs: { PDropdown: PDropdownStub, PToast: true } },
  });
}

describe("FeedContentFeedback", () => {
  it("submits a quality issue and resets local state for the next article", async () => {
    apiRequestResult.mockResolvedValue({ ok: true, status: 200, data: {} });
    const wrapper = mountFeedback();
    const layoutButton = wrapper
      .findAll('[role="menuitem"]')
      .find((button) => button.text().includes("排版错乱"));
    expect(layoutButton).toBeTruthy();

    await layoutButton!.trigger("click");
    await flushPromises();

    expect(apiRequestResult).toHaveBeenCalledWith(
      "/api/v1/feed/items/item-1/content-feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ kind: "layout", variant: "rss" }),
      }),
    );
    expect(layoutButton!.attributes("disabled")).toBeDefined();

    await wrapper.setProps({ itemId: "item-2", variant: "full_text" });
    await flushPromises();
    const nextLayoutButton = wrapper
      .findAll('[role="menuitem"]')
      .find((button) => button.text().includes("排版错乱"));
    expect(nextLayoutButton?.attributes("disabled")).toBeUndefined();
  });
});
