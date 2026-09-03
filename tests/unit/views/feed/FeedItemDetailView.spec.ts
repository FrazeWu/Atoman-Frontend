import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FeedItemDetailView from "@/views/feed/FeedItemDetailView.vue";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";

const { isMobileApp } = vi.hoisted(() => ({ isMobileApp: { value: false } }));

vi.mock("@/utils/appRuntime", () => ({
  isStandaloneMobileApp: () => isMobileApp.value,
}));

const response = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200 });

describe("FeedItemDetailView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
    isMobileApp.value = false;
  });

  it("marks a signed-in reader's feed item as read after loading it", async () => {
    const auth = useAuthStore();
    auth.token = "token";
    auth.isAuthenticated = true;
    const feedStore = useFeedStore();
    const markItemsRead = vi
      .spyOn(feedStore, "markItemsRead")
      .mockResolvedValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/feed/items/feed-item-1")) {
        return response({
          item: {
            id: "feed-item-1",
            feed_source_id: "source-1",
            feed_source: { id: "source-1", title: "RSS Source" },
            title: "Subscription article",
            published_at: "2026-08-28T00:00:00Z",
          },
          reader: {},
        });
      }
      return response({ ok: true });
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/feed/item/:id", component: FeedItemDetailView }],
    });
    await router.push("/feed/item/feed-item-1");
    await router.isReady();

    mount(FeedItemDetailView, {
      global: {
        plugins: [router],
        stubs: {
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
          PEmpty: true,
        },
      },
    });
    await flushPromises();

    expect(markItemsRead).toHaveBeenCalledWith(["feed-item-1"]);
  });

  it("在移动端打开当前 RSS 来源的文章列表", async () => {
    isMobileApp.value = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/feed/items/feed-item-1")) {
        return response({
          item: {
            id: "feed-item-1",
            feed_source_id: "source-1",
            feed_source: { id: "source-1", title: "RSS Source" },
            title: "Subscription article",
            published_at: "2026-08-28T00:00:00Z",
          },
          reader: {},
        });
      }
      return response({ ok: true });
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/feed/item/:id", component: FeedItemDetailView }],
    });
    await router.push("/feed/item/feed-item-1");
    await router.isReady();

    const wrapper = mount(FeedItemDetailView, {
      global: {
        plugins: [router],
        stubs: {
          FeedArticleSheet: {
            template: '<button data-test="open-source" @click="$emit(\'open-source\')" />',
          },
          FeedSourceArticlesSheet: true,
          PEmpty: true,
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-test="open-source"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/feed?source_id=source-1");
  });
});
