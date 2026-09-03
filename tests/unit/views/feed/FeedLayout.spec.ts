import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FeedLayout from "@/views/feed/FeedLayout.vue";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";
import type { SubscriptionHubTree } from "@/types";

const { standaloneMobile } = vi.hoisted(() => ({ standaloneMobile: { value: false } }));

vi.mock("@/utils/appRuntime", () => ({
  isStandaloneMobileApp: () => standaloneMobile.value,
}));

const subscriptionHubTree: SubscriptionHubTree = {
  types: [
    {
      subscription_type: "podcast",
      groups: [
        {
          id: "podcast-group",
          user_id: "user-1",
          subscription_type: "podcast",
          name: "常听节目",
          memberships: [
            {
              id: "podcast-member",
              user_id: "user-1",
              subscription_type: "podcast",
              group_id: "podcast-group",
              feed_source_id: "shared-channel",
              title: "原子谈话",
            },
          ],
        },
      ],
    },
    {
      subscription_type: "video",
      groups: [
        {
          id: "video-group",
          user_id: "user-1",
          subscription_type: "video",
          name: "关注频道",
          memberships: [
            {
              id: "video-member",
              user_id: "user-1",
              subscription_type: "video",
              group_id: "video-group",
              feed_source_id: "shared-channel",
              title: "原子谈话",
            },
          ],
        },
      ],
    },
    { subscription_type: "blog", groups: [] },
    { subscription_type: "rss", groups: [] },
  ],
};

const makeRouter = async (initialPath = "/feed") => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/feed", component: { template: "<div />" } },
      { path: "/feed/sources", component: { template: "<div />" } },
      { path: "/feed/subscriptions", component: { template: "<div />" } },
      { path: "/feed/starred", component: { template: "<div />" } },
    ],
  });

  await router.push(initialPath);
  await router.isReady();
  return router;
};

const mountLayout = async (initialPath = "/feed", authenticated = true) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const authStore = useAuthStore();
  authStore.token = authenticated ? "token" : null;
  authStore.user = authenticated
    ? { username: "fafa", email: "fafa@example.com" }
    : null;
  authStore.isAuthenticated = authenticated;

  const feedStore = useFeedStore();
  feedStore.subscriptionHubTree = subscriptionHubTree;
  vi.spyOn(feedStore, "fetchSubscriptions").mockResolvedValue(undefined);
  vi.spyOn(feedStore, "fetchGroups").mockResolvedValue(undefined);
  const fetchSubscriptionHubTree = vi
    .spyOn(feedStore, "fetchSubscriptionHubTree")
    .mockResolvedValue(true);

  const router = await makeRouter(initialPath);
  const pushSpy = vi.spyOn(router, "push");

  const wrapper = mount(FeedLayout, {
    global: {
      plugins: [pinia, router],
    },
  });

  await flushPromises();
  pushSpy.mockClear();

  return { wrapper, router, pushSpy, fetchSubscriptionHubTree };
};

describe("FeedLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    standaloneMobile.value = false;
  });

  it("renders the type-isolated subscription tree in the sidebar", async () => {
    const { wrapper } = await mountLayout(
      "/feed/subscriptions?hub_type=podcast&hub_group_id=podcast-group",
    );

    expect(wrapper.findAll(".p-sidebar-item")).toHaveLength(4);
    expect(wrapper.text()).toContain("我的订阅");
    expect(wrapper.text()).toContain("播客");
    expect(wrapper.text()).toContain("视频");
    expect(wrapper.text()).toContain("常听节目");
    expect(wrapper.text()).not.toContain("关注频道");
    expect(wrapper.findAll(".subscription-hub-sidebar__membership")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("全部订阅");
  });

  it("routes a selected subscription leaf to its isolated update context", async () => {
    const { wrapper, pushSpy } = await mountLayout("/feed");

    await wrapper
      .get('[data-testid="subscription-hub-type-video"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="subscription-hub-membership-video-member"]')
      .trigger("click");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/feed/subscriptions",
        query: expect.objectContaining({
          hub_type: "video",
          hub_group_id: "video-group",
          hub_membership_id: "video-member",
          source_id: undefined,
          group_id: undefined,
        }),
      }),
    );
  });

  it("selects the first group when a type is chosen", async () => {
    const { wrapper, pushSpy } = await mountLayout("/feed");

    await wrapper
      .get('[data-testid="subscription-hub-type-podcast"]')
      .trigger("click");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/feed/subscriptions",
        query: expect.objectContaining({
          hub_type: "podcast",
          hub_group_id: "podcast-group",
          hub_membership_id: undefined,
        }),
      }),
    );
  });

  it("opens unified subscription management from the tree", async () => {
    const { wrapper, pushSpy } = await mountLayout("/feed");

    await wrapper
      .get('[data-testid="subscription-hub-manage"]')
      .trigger("click");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/feed/sources",
        query: expect.objectContaining({
          manage_subscriptions: "1",
          manage_tab: "sources",
        }),
      }),
    );
  });

  it("opens the same tree on mobile and selects a leaf in the current timeline", async () => {
    const { wrapper, pushSpy } = await mountLayout("/feed");

    expect(
      wrapper.find('[data-testid="feed-mobile-sources-trigger"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists(),
    ).toBe(false);

    await wrapper
      .get('[data-testid="feed-mobile-sources-trigger"]')
      .trigger("click");
    await flushPromises();

    const sheet = wrapper.get('[data-testid="feed-mobile-sources-sheet"]');
    expect(sheet.text()).toContain("我的订阅");
    expect(sheet.text()).toContain("原子谈话");

    await sheet
      .get('[data-testid="subscription-hub-membership-podcast-member"]')
      .trigger("click");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/feed/subscriptions",
        query: expect.objectContaining({
          hub_type: "podcast",
          hub_group_id: "podcast-group",
          hub_membership_id: "podcast-member",
        }),
      }),
    );
    expect(
      wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists(),
    ).toBe(false);
  });

  it("replaces the mobile content with the subscription source page and restores it on close", async () => {
    standaloneMobile.value = true;
    const { wrapper } = await mountLayout("/feed/subscriptions");

    await wrapper.get('[data-testid="feed-mobile-sources-trigger"]').trigger("click");
    await flushPromises();

    expect(wrapper.get(".a-main-content").attributes("style")).toContain("display: none");
    expect(wrapper.get('[data-testid="feed-mobile-sources-sheet"]').isVisible()).toBe(true);

    await wrapper.get('[data-testid="feed-mobile-sources-close"]').trigger("click");
    await flushPromises();

    expect(wrapper.get(".a-main-content").isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(false);
  });

  it("does not expose the mobile subscription entry point when signed out", async () => {
    const { wrapper } = await mountLayout("/feed", false);

    expect(
      wrapper.find('[data-testid="feed-mobile-sources-trigger"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists(),
    ).toBe(false);
  });

  it("clears the subscription tree when authentication is removed", async () => {
    const { wrapper } = await mountLayout("/feed");
    const authStore = useAuthStore();
    const feedStore = useFeedStore();

    expect(wrapper.text()).toContain("原子谈话");

    authStore.isAuthenticated = false;
    authStore.token = null;
    authStore.user = null;
    await flushPromises();

    expect(feedStore.subscriptionHubTree).toEqual({ types: [] });
    expect(wrapper.text()).not.toContain("原子谈话");
  });

  it("refetches the subscription tree when an auth token becomes available", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore();
    authStore.user = { username: "fafa", email: "fafa@example.com" };
    authStore.token = null;
    authStore.isAuthenticated = true;

    const feedStore = useFeedStore();
    feedStore.subscriptionHubTree = { types: [] };
    vi.spyOn(feedStore, "fetchSubscriptions").mockResolvedValue(undefined);
    vi.spyOn(feedStore, "fetchGroups").mockResolvedValue(undefined);
    const fetchSubscriptionHubTree = vi
      .spyOn(feedStore, "fetchSubscriptionHubTree")
      .mockResolvedValue(true);

    const router = await makeRouter("/feed");
    mount(FeedLayout, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();
    expect(fetchSubscriptionHubTree).toHaveBeenCalledTimes(1);

    authStore.token = "token";
    await flushPromises();

    expect(fetchSubscriptionHubTree).toHaveBeenCalledTimes(2);
  });
});
