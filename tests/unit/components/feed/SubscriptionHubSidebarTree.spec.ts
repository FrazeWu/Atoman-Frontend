import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SubscriptionHubSidebarTree from "@/components/feed/SubscriptionHubSidebarTree.vue";
import type { SubscriptionHubTree } from "@/types";

const tree: SubscriptionHubTree = {
  types: [
    {
      subscription_type: "podcast",
      has_content: true,
      groups: [
        {
          id: "podcast-group",
          user_id: "viewer",
          subscription_type: "podcast",
          name: "常听节目",
          memberships: [
            {
              id: "podcast-member",
              user_id: "viewer",
              subscription_type: "podcast",
              group_id: "podcast-group",
              feed_source_id: "podcast-source",
              title: "原子谈话",
              unread_count: 3,
              feed_source: {
                id: "podcast-source",
                source_type: "internal_channel",
                hash: "podcast",
                cover_url: "/podcast.webp",
                created_at: "",
              },
            },
          ],
        },
      ],
    },
    {
      subscription_type: "video",
      has_content: true,
      groups: [
        {
          id: "video-group",
          user_id: "viewer",
          subscription_type: "video",
          name: "关注频道",
          memberships: [
            {
              id: "video-member",
              user_id: "viewer",
              subscription_type: "video",
              group_id: "video-group",
              feed_source_id: "video-source",
              title: "视频频道",
              unread_count: 2,
              feed_source: {
                id: "video-source",
                source_type: "internal_user",
                hash: "video",
                cover_url: "/video.webp",
                created_at: "",
              },
            },
          ],
        },
      ],
    },
    {
      subscription_type: "blog",
      groups: [
        {
          id: "blog-group",
          user_id: "viewer",
          subscription_type: "blog",
          name: "博客分组",
          memberships: [
            {
              id: "blog-member",
              user_id: "viewer",
              subscription_type: "blog",
              group_id: "blog-group",
              feed_source_id: "blog-source",
              title: "博客作者",
              unread_count: 0,
              feed_source: {
                id: "blog-source",
                source_type: "internal_collection",
                hash: "blog",
                cover_url: "/blog.webp",
                created_at: "",
              },
            },
          ],
        },
      ],
    },
    {
      subscription_type: "rss",
      groups: [
        {
          id: "rss-group",
          user_id: "viewer",
          subscription_type: "rss",
          name: "RSS 分组",
          memberships: [
            {
              id: "rss-member",
              user_id: "viewer",
              subscription_type: "rss",
              group_id: "rss-group",
              feed_source_id: "rss-source",
              title: "某个 RSS",
              unread_count: 7,
              feed_source: {
                id: "rss-source",
                source_type: "external_rss",
                hash: "rss",
                rss_url: "https://example.com/feed.xml",
                created_at: "",
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("SubscriptionHubSidebarTree", () => {
  it("renders a flat source list without group names", () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } });

    expect(wrapper.text()).not.toContain("常听节目");
    expect(wrapper.text()).not.toContain("关注频道");
    expect(wrapper.text()).not.toContain("博客分组");
    expect(wrapper.text()).not.toContain("RSS 分组");
    expect(wrapper.findAll(".subscription-hub-sidebar__source")).toHaveLength(
      4,
    );
  });

  it("shows source type, avatar, name, and real unread count for every source", () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } });
    const sources = wrapper.findAll(".subscription-hub-sidebar__source");

    expect(sources.map((source) => source.text())).toEqual([
      expect.stringContaining("播客原子谈话3"),
      expect.stringContaining("账号视频频道2"),
      expect.stringContaining("频道博客作者0"),
      expect.stringContaining("RSS某个 RSS7"),
    ]);
    expect(
      sources.map((source) => source.find(".p-avatar img").attributes("src")),
    ).toEqual([
      "/podcast.webp",
      "/video.webp",
      "/blog.webp",
      "https://example.com/favicon.ico",
    ]);
  });

  it("selects a source with its hidden group context for timeline compatibility", async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } });

    await wrapper
      .get('[data-testid="subscription-hub-membership-video-member"]')
      .trigger("click");

    expect(wrapper.emitted("select-context")).toEqual([
      [
        {
          subscriptionType: "video",
          groupId: "video-group",
          membershipId: "video-member",
        },
      ],
    ]);
  });

  it("selects all updates for a fixed module and does not render the type layer", async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: { tree, fixedType: "video", activeType: "video" },
    });

    expect(
      wrapper.get('[data-testid="subscription-hub-all-video"]').text(),
    ).toContain("全部更新");
    expect(
      wrapper.find('[data-testid="subscription-hub-type-video"]').exists(),
    ).toBe(false);
    expect(wrapper.findAll(".subscription-hub-sidebar__source")).toHaveLength(
      1,
    );

    await wrapper
      .get('[data-testid="subscription-hub-all-video"]')
      .trigger("click");
    expect(wrapper.emitted("select-context")).toEqual([
      [{ subscriptionType: "video" }],
    ]);
  });

  it("keeps an empty fixed module out of the layout", () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree: { types: [{ subscription_type: "blog", groups: [] }] },
        fixedType: "blog",
      },
    });

    expect(wrapper.find(".subscription-hub-sidebar").exists()).toBe(false);
  });

  it("exposes loading, error retry, and management actions", async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: { tree, loading: true },
    });
    expect(wrapper.find('[aria-label="正在加载订阅"]').exists()).toBe(true);

    await wrapper.setProps({ loading: false, error: "加载失败" });
    await wrapper
      .get('[data-testid="subscription-hub-retry"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="subscription-hub-manage"]')
      .trigger("click");

    expect(wrapper.emitted("retry")).toHaveLength(1);
    expect(wrapper.emitted("manage")).toHaveLength(1);
  });
});
