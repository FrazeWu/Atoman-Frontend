import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SubscriptionManageSheet from "@/components/feed/SubscriptionManageSheet.vue";

const stubs = {
  PSheet: {
    props: ["show", "title"],
    template: '<section v-if="show"><slot /></section>',
  },
  PField: { template: "<label><slot /></label>" },
  PInput: { template: "<input />" },
  PButton: {
    props: ["label", "disabled"],
    emits: ["click"],
    template:
      '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
  PSelect: true,
  SubscriptionRulesPanel: true,
};

const mountSheet = () =>
  mount(SubscriptionManageSheet, {
    props: {
      show: true,
      subscriptions: [
        {
          id: "external-sub",
          user_id: "user-1",
          feed_source_id: "external-source",
          title: "External Feed",
          feed_source: {
            id: "external-source",
            source_type: "external_rss",
            hash: "external-source",
            title: "External Feed",
            rss_url: "https://example.com/feed.xml",
            last_fetched_at: "2026-07-20T02:00:00Z",
            fetch_status: "blocked",
            fetch_http_status: 429,
            fetch_last_success_at: "2026-07-20T01:30:00Z",
            fetch_next_at: "2026-07-20T04:00:00Z",
            fetch_consecutive_failures: 2,
            fetch_last_error_code: "http_429",
            fetch_last_error: "feed returned HTTP 429",
            created_at: "2026-07-20T00:00:00Z",
          },
          created_at: "2026-07-20T00:00:00Z",
        },
        {
          id: "internal-sub",
          user_id: "user-1",
          feed_source_id: "internal-source",
          title: "Internal Feed",
          feed_source: {
            id: "internal-source",
            source_type: "internal_channel",
            hash: "internal-source",
            title: "Internal Feed",
            created_at: "2026-07-20T00:00:00Z",
          },
          created_at: "2026-07-20T00:00:00Z",
        },
      ],
      groups: [],
      subscriptionRules: [],
      ruleApplySummary: null,
      filterRules: { mutedSourceIds: [], hiddenKeywords: [] },
      automationRules: {
        autoMarkReadSourceIds: [],
        autoReadingListSourceIds: [],
      },
      syncingSubscriptionIds: new Set<string>(),
      syncingAllSubscriptions: false,
      subscriptionSyncResults: {
        "external-sub": {
          subscription_id: "external-sub",
          feed_source_id: "external-source",
          fetched_items: 5,
          new_items: 3,
          synced_at: "2026-07-20T02:00:00Z",
          success: true,
        },
      },
    },
    global: { stubs },
  });

describe("SubscriptionManageSheet sync controls", () => {
  it("refreshes all sources and only offers per-source refresh for external RSS", async () => {
    const wrapper = mountSheet();
    const refreshAll = wrapper.get(
      'button[data-test="sync-all-subscriptions"]',
    );
    await refreshAll.trigger("click");
    expect(wrapper.emitted("sync-all-subscriptions")).toHaveLength(1);

    await wrapper
      .get('[data-test="subscription-manage-tab-sources"]')
      .trigger("click");
    const refreshButtons = wrapper.findAll(
      'button[data-test="sync-subscription"]',
    );
    expect(refreshButtons).toHaveLength(1);
    await refreshButtons[0]!.trigger("click");
    expect(wrapper.emitted("sync-subscription")).toEqual([["external-sub"]]);
  });

  it("shows the latest fetch time and new item count", async () => {
    const wrapper = mountSheet();
    await wrapper
      .get('[data-test="subscription-manage-tab-sources"]')
      .trigger("click");
    expect(wrapper.text()).toContain("最近更新");
    expect(wrapper.text()).toContain("新增 3 篇");
  });

  it("shows source retry diagnostics and makes recovery the only source action", async () => {
    const wrapper = mountSheet();
    await wrapper
      .get('[data-test="subscription-manage-tab-sources"]')
      .trigger("click");

    expect(wrapper.text()).toContain("暂时受限");
    expect(wrapper.text()).toContain("HTTP 429");
    expect(wrapper.text()).toContain("连续失败 2 次");
    expect(wrapper.text()).toContain("下次重试");
    expect(wrapper.text()).toContain("来源暂时限制请求，系统会自动重试。");
    expect(wrapper.get('button[data-test="sync-subscription"]').text()).toBe(
      "重试",
    );
    expect(
      wrapper.findAll("button").some((button) => button.text() === "检查"),
    ).toBe(false);
  });

  it("summarizes source health and loads recent diagnostics on demand", async () => {
    const wrapper = mountSheet();
    await wrapper
      .get('[data-test="subscription-manage-tab-sources"]')
      .trigger("click");

    expect(wrapper.text()).toContain("来源健康概览");
    expect(wrapper.text()).toContain("暂时受限 1");

    await wrapper.get('[data-test="subscription-settings-toggle"]').trigger("click")
    await wrapper
      .get('[data-test="load-subscription-diagnostics"]')
      .trigger("click");
    expect(wrapper.emitted("load-subscription-diagnostics")).toEqual([
      ["external-sub"],
    ]);

    await wrapper.setProps({
      subscriptionDiagnostics: {
        "external-sub": [
          {
            id: "diagnostic-1",
            feed_source_id: "external-source",
            kind: "rss_fetch_failure",
            error_code: "http_429",
            message: "feed returned HTTP 429",
            attempt_count: 2,
            created_at: "2026-07-20T02:00:00Z",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("抓取失败");
    expect(wrapper.text()).toContain("feed returned HTTP 429");
  });

  it("disables refresh-all while one source is refreshing", async () => {
    const wrapper = mountSheet();
    await wrapper.setProps({
      syncingSubscriptionIds: new Set(["external-sub"]),
    });

    const refreshAll = wrapper.get(
      'button[data-test="sync-all-subscriptions"]',
    );
    expect(refreshAll.attributes("disabled")).toBeDefined();
    await refreshAll.trigger("click");
    expect(wrapper.emitted("sync-all-subscriptions")).toBeUndefined();
  });
});
