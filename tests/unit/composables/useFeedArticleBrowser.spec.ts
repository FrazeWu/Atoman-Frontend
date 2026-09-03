import { computed, defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFeedArticleBrowser } from "@/composables/feed/useFeedArticleBrowser";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";
import type { TimelineItem } from "@/types";

const { isMobileApp } = vi.hoisted(() => ({ isMobileApp: { value: false } }));

vi.mock("@/utils/appRuntime", () => ({
  isStandaloneMobileApp: () => isMobileApp.value,
}));

function deferredResponse(body: unknown) {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: () => resolve(new Response(JSON.stringify(body), { status: 200 })),
  };
}

const createFeedItem = (
  id: string,
  sourceId: string,
  title: string,
): TimelineItem =>
  ({
    type: "feed_item",
    feed_item: {
      id,
      feed_source_id: sourceId,
      feed_source: {
        id: sourceId,
        title,
      },
    },
    published_at: "2026-07-19T00:00:00Z",
    is_read: false,
  }) as TimelineItem;

describe("useFeedArticleBrowser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    isMobileApp.value = false;
  });

  it("快速切换来源时忽略过期请求结果", async () => {
    setActivePinia(createPinia());

    const sourceAItem = createFeedItem("item-a", "source-a", "来源 A");
    const sourceBItem = createFeedItem("item-b", "source-b", "来源 B");
    sourceBItem.feed_item!.feed_source!.cover_url = "https://cdn.example.com/source-b-cover.png";
    const sourceAResponse = deferredResponse({ data: [sourceAItem] });
    const sourceBResponse = deferredResponse({ data: [sourceBItem] });

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("feed_source_id=source-a"))
        return sourceAResponse.promise;
      if (url.includes("feed_source_id=source-b"))
        return sourceBResponse.promise;
      throw new Error(`unexpected url: ${url}`);
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
    await router.push("/");
    await router.isReady();

    const timeline = ref<TimelineItem[]>([]);
    let browser!: ReturnType<typeof useFeedArticleBrowser>;
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => timeline.value),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) =>
            item.feed_item?.id || item.post?.id || item.published_at || "",
          feedItemActionIDs: (item) => [item.id],
        });
        return () => null;
      },
    });

    const wrapper = mount(Harness, {
      global: {
        plugins: [router],
      },
    });

    const firstOpen = browser.openFeedItemSourceSheet(sourceAItem.feed_item!);
    const secondOpen = browser.openFeedItemSourceSheet(sourceBItem.feed_item!);

    expect(browser.selectedSource.value?.id).toBe("source-b");
    expect(browser.selectedSource.value?.imageUrl).toBe(
      "https://cdn.example.com/source-b-cover.png",
    );
    expect(browser.sourceArticlesLoading.value).toBe(true);

    sourceBResponse.resolve();
    await secondOpen;
    await flushPromises();

    expect(browser.selectedSource.value?.id).toBe("source-b");
    expect(
      browser.sourceArticles.value.map((item) => item.feed_item?.id),
    ).toEqual(["item-b"]);
    expect(browser.sourceArticlesLoading.value).toBe(false);

    sourceAResponse.resolve();
    await firstOpen;
    await flushPromises();

    expect(browser.selectedSource.value?.id).toBe("source-b");
    expect(
      browser.sourceArticles.value.map((item) => item.feed_item?.id),
    ).toEqual(["item-b"]);

    wrapper.unmount();
  });

  it("在移动端打开来源时进入筛选后的时间线", async () => {
    isMobileApp.value = true;
    setActivePinia(createPinia());

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
    await router.push("/");
    await router.isReady();

    let browser!: ReturnType<typeof useFeedArticleBrowser>;
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => []),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) => item.feed_item?.id || item.post?.id || "",
          feedItemActionIDs: (item) => [item.id],
        });
        return () => null;
      },
    });
    const wrapper = mount(Harness, { global: { plugins: [router] } });

    await browser.openFeedItemSourceSheet(createFeedItem("item-1", "source-1", "来源").feed_item!);

    expect(router.currentRoute.value.fullPath).toBe("/feed?source_id=source-1");
    wrapper.unmount();
  });

  it("未登录时从文章抽屉订阅来源会跳转登录", async () => {
    setActivePinia(createPinia());

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/feed", component: { template: "<div />" } },
        { path: "/feed/item/:id", component: { template: "<div />" } },
        { path: "/login", component: { template: "<div />" } },
      ],
    });
    await router.push("/feed");
    await router.isReady();

    let browser!: ReturnType<typeof useFeedArticleBrowser>;
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => []),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) => item.feed_item?.id || item.post?.id || "",
          feedItemActionIDs: (item) => [item.id],
        });
        return () => null;
      },
    });
    const wrapper = mount(Harness, { global: { plugins: [router] } });

    await browser.openArticleSheet(createFeedItem("item-1", "source-1", "来源"));
    await browser.subscribeSelectedArticleSource();
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query.redirect).toContain(
      "/feed?subscribe_source_id=source-1",
    );
    wrapper.unmount();
  });

  it("从统一订阅树识别已订阅的站内频道", async () => {
    setActivePinia(createPinia());
    const feedStore = useFeedStore();
    feedStore.subscriptionHubTree = {
      types: [{
        subscription_type: "blog",
        groups: [{
          id: "blog-group",
          user_id: "user-1",
          subscription_type: "blog",
          name: "博客",
          memberships: [{
            id: "channel-membership",
            user_id: "user-1",
            subscription_type: "blog",
            group_id: "blog-group",
            feed_source_id: "channel-source",
            title: "原子频道",
            feed_source: {
              id: "channel-source",
              source_type: "internal_channel",
              source_id: "channel-1",
              hash: "channel-source",
              created_at: "",
            },
          }],
        }],
      }],
    };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
    await router.push("/");
    await router.isReady();

    let browser!: ReturnType<typeof useFeedArticleBrowser>;
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => []),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) => item.post?.id || "",
          feedItemActionIDs: (item) => [item.id],
        });
        return () => null;
      },
    });
    const wrapper = mount(Harness, { global: { plugins: [router] } });

    browser.openArticleSheet({
      type: "post",
      post: {
        id: "post-1",
        title: "文章",
        channel_id: "channel-1",
        channel: { id: "channel-1", name: "原子频道" },
      },
    } as TimelineItem);

    expect(browser.selectedArticleSource.value).toEqual(expect.objectContaining({
      id: "channel-1",
      subscribed: true,
    }));
    wrapper.unmount();
  });

  it("详情页订阅成功后刷新全部订阅状态", async () => {
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.isAuthenticated = true;
    authStore.token = "token";
    const feedStore = useFeedStore();
    vi.spyOn(feedStore, "subscribeToChannel").mockResolvedValue(true);
    const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions").mockResolvedValue(true);
    const fetchGroups = vi.spyOn(feedStore, "fetchGroups").mockResolvedValue(true);
    const fetchTree = vi.spyOn(feedStore, "fetchSubscriptionHubTree").mockResolvedValue(true);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
    await router.push("/");
    await router.isReady();

    let browser!: ReturnType<typeof useFeedArticleBrowser>;
    const Harness = defineComponent({
      setup() {
        browser = useFeedArticleBrowser({
          visibleTimeline: computed(() => []),
          subscriptions: computed(() => []),
          focusedIndex: ref(-1),
          itemKey: (item) => item.post?.id || "",
          feedItemActionIDs: (item) => [item.id],
        });
        return () => null;
      },
    });
    const wrapper = mount(Harness, { global: { plugins: [router] } });
    browser.openArticleSheet({
      type: "post",
      post: {
        id: "post-1",
        title: "文章",
        channel_id: "channel-1",
        channel: { id: "channel-1", name: "原子频道" },
      },
    } as TimelineItem);

    await browser.subscribeSelectedArticleSource();

    expect(fetchSubscriptions).toHaveBeenCalled();
    expect(fetchGroups).toHaveBeenCalled();
    expect(fetchTree).toHaveBeenCalled();
    wrapper.unmount();
  });
});
