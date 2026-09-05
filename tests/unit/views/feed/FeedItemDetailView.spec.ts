import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FeedItemDetailView from "@/views/feed/FeedItemDetailView.vue";
import { feedArticleRouteState } from "@/composables/feed/feedArticleRouteState";
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

  it("未登录时也显示 RSS 来源订阅按钮并引导登录", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/feed/items/feed-item-1")) {
        return response({
          item: {
            id: "feed-item-1",
            feed_source_id: "source-1",
            feed_source: {
              id: "source-1",
              title: "RSS Source",
              rss_url: "https://example.com/feed.xml",
            },
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
      routes: [
        { path: "/feed/item/:id", component: FeedItemDetailView },
        { path: "/login", component: { template: "<div />" } },
      ],
    });
    await router.push("/feed/item/feed-item-1");
    await router.isReady();

    const wrapper = mount(FeedItemDetailView, {
      global: {
        plugins: [router],
        stubs: {
          FeedArticleSheet: {
            props: ["showSourceSubscribe"],
            template: '<button v-if="showSourceSubscribe" data-test="subscribe" @click="$emit(\'subscribe-source\')">订阅来源</button>',
          },
          FeedSourceArticlesSheet: true,
          PEmpty: true,
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-test="subscribe"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(
      "/login?redirect=/feed/item/feed-item-1",
    );
  });

  it("在当前详情 Sheet 内替换相邻文章而不新增页面历史", async () => {
    const articleOne = {
      type: "feed_item" as const,
      published_at: "2026-08-28T00:00:00Z",
      is_read: true,
      feed_item: {
        id: "feed-item-1",
        feed_source_id: "source-1",
        feed_source: { id: "source-1", title: "RSS Source" },
        title: "第一篇文章",
        published_at: "2026-08-28T00:00:00Z",
      },
    };
    const articleTwo = {
      ...articleOne,
      feed_item: {
        ...articleOne.feed_item,
        id: "feed-item-2",
        title: "第二篇文章",
      },
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const item = url.includes("feed-item-2") ? articleTwo.feed_item : articleOne.feed_item;
      return response({ item, reader: {} });
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/feed/item/:id", component: FeedItemDetailView }],
    });
    const initialRouteState = feedArticleRouteState({
      article: articleOne,
      articles: [articleOne, articleTwo],
      source: null,
      sourceArticles: [],
    });
    await router.push({
      path: "/feed/item/feed-item-1",
      state: initialRouteState,
    });
    window.history.replaceState({ ...window.history.state, ...initialRouteState }, "", "/feed/item/feed-item-1");
    await router.isReady();
    const replaceSpy = vi.spyOn(router, "replace");

    const wrapper = mount(FeedItemDetailView, {
      global: {
        plugins: [router],
        stubs: {
          FeedArticleSheet: {
            props: ["show", "article", "hasNext"],
            template: `
              <section v-if="show">
                <h1 data-test="article-title">{{ article?.feed_item?.title }}</h1>
                <button v-if="hasNext" data-test="next" @click="$emit('next')">下一篇</button>
              </section>
            `,
          },
          FeedSourceArticlesSheet: true,
          PEmpty: true,
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-test="next"]').trigger("click");
    await flushPromises();

    expect(replaceSpy).toHaveBeenCalledWith(expect.objectContaining({
      path: "/feed/item/feed-item-2",
    }));
    expect(router.currentRoute.value.path).toBe("/feed/item/feed-item-2");
    expect(wrapper.get('[data-test="article-title"]').text()).toBe("第二篇文章");
    wrapper.unmount();
  });
});
