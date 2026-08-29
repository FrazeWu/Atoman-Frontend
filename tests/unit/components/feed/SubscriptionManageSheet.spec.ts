import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import SubscriptionManageSheet from "@/components/feed/SubscriptionManageSheet.vue";

const mountSheet = () =>
	mount(SubscriptionManageSheet, {
		props: {
			show: true,
			busy: false,
			healthChecking: false,
			subscriptionRules: [
				{
					id: "rule-1",
					name: "播客自动整理",
					enabled: true,
					position: 0,
					match_type: "source_category",
					conditions_json: {
						category: "podcast",
					},
					action_group_id: "group-1",
					action_muted: true,
					action_auto_mark_read: false,
					action_auto_add_reading_list: true,
				},
			],
			ruleApplySummary: {
				scanned_count: 12,
				updated_count: 5,
				group_changed_count: 3,
				muted_changed_count: 2,
				auto_mark_read_changed_count: 0,
				auto_add_reading_list_changed_count: 4,
			},
			filterRules: {
				mutedSourceIds: [],
				hiddenKeywords: [],
			},
			automationRules: {
				autoMarkReadSourceIds: [],
				autoAddReadingListSourceIds: [],
			},
			groups: [
				{
					id: "group-1",
					user_id: "user-1",
					name: "默认分组",
					created_at: "2026-06-17T00:00:00Z",
					updated_at: "2026-06-17T00:00:00Z",
				},
			],
			subscriptions: [
				{
					id: "sub-1",
					user_id: "user-1",
					feed_source_id: "source-1",
					title: "Example Feed",
					subscription_group_id: "group-1",
					health_status: "error",
					error_message: "HTTP 500",
					last_checked: "2026-06-17T08:30:00Z",
					created_at: "2026-06-17T00:00:00Z",
					feed_source: {
						id: "source-1",
						source_type: "external_rss",
						rss_url: "https://example.com/feed.xml",
						hash: "source-1",
						title: "Example Feed",
						created_at: "2026-06-17T00:00:00Z",
					},
				},
			],
		},
		global: {
			stubs: {
				PSheet: { template: "<div><slot /></div>" },
				PField: {
					props: ["label"],
					template: "<label><span>{{ label }}</span><slot /></label>",
				},
				SubscriptionRuleEditorSheet: true,
			},
		},
	});

describe("SubscriptionManageSheet", () => {
	it("does not render a duplicate sheet title", () => {
		const wrapper = mountSheet();

		expect(wrapper.find("h2").exists()).toBe(false);
	});

	it("shows the source name instead of the raw rss url in subscription cards", async () => {
		const wrapper = mountSheet();

		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");

		expect(wrapper.text()).not.toContain("https://example.com/feed.xml");
	});

	it("shows subscription health details without duplicate check actions", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");

		expect(wrapper.text()).toContain("异常");
		expect(wrapper.text()).toContain("HTTP 500");
		expect(wrapper.text()).toContain("2026-06-17 16:30");
		expect(wrapper.get('[data-test="sync-subscription"]').text()).toBe("重试");
		expect(wrapper.findAll("button").some((button) => button.text() === "检查")).toBe(false);
	});

	it("emits subscription flag updates from source cards", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");
		const flags = wrapper.findAll('.subscription-flags input[type="checkbox"]');

		await flags[0].setValue(true);
		await flags[1].setValue(true);
		await flags[2].setValue(true);

		expect(wrapper.emitted("update-subscription")).toEqual([
			["sub-1", { is_muted: true }],
			["sub-1", { auto_mark_read: true }],
			["sub-1", { auto_add_reading_list: true }],
		]);
	});

	it("emits a priority update from a source card", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");

		const prioritySelect = wrapper.get('[data-test="subscription-priority"]');
		await prioritySelect.get(".p-select-trigger").trigger("click");
		await prioritySelect
			.findAll(".p-select-option")
			.find((option) => option.text() === "高优先")!
			.trigger("click");

		expect(wrapper.emitted("update-subscription")).toEqual([
			["sub-1", { priority: "high" }],
		]);
	});

	it("allows moving a subscription back to unassigned", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");
		const groupSelect = wrapper.get('[data-test="subscription-group"]');

		await groupSelect.get(".p-select-trigger").trigger("click");
		expect(groupSelect.text()).toContain("未分类");

		await groupSelect
			.findAll(".p-select-option")
			.find((option) => option.text() === "未分类")!
			.trigger("click");

		expect(wrapper.emitted("move-subscription")).toEqual([["sub-1", ""]]);
	});

	it("separates manage content into task tabs", async () => {
		const wrapper = mountSheet();

		expect(
			wrapper.get('[data-test="subscription-manage-tab-groups"]').classes(),
		).toContain("is-active");
		expect(wrapper.text()).not.toContain("Example Feed");
		expect(wrapper.text()).not.toContain("规则管理");

		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");

		expect(
			wrapper.get('[data-test="subscription-manage-tab-sources"]').classes(),
		).toContain("is-active");
		expect(wrapper.text()).toContain("Example Feed");

		await wrapper
			.get('[data-test="subscription-manage-tab-rules"]')
			.trigger("click");

		expect(
			wrapper.get('[data-test="subscription-manage-tab-rules"]').classes(),
		).toContain("is-active");
		expect(wrapper.text()).toContain("规则管理");
		expect(wrapper.text()).toContain("播客自动整理");
		expect(wrapper.text()).not.toContain("Example Feed");

		await wrapper
			.get('[data-test="subscription-manage-tab-keywords"]')
			.trigger("click");

		expect(
			wrapper.get('[data-test="subscription-manage-tab-keywords"]').classes(),
		).toContain("is-active");
		expect(wrapper.text()).toContain("过滤规则");
		expect(wrapper.text()).not.toContain("播客自动整理");
	});

	it("emits OPML import, export, and failed-source retry actions", async () => {
		const wrapper = mountSheet();
		const file = new File(
			['<opml version="2.0"><body /></opml>'],
			"feeds.opml",
			{ type: "text/xml" },
		);
		const failure = {
			url: "https://example.com/retry.xml",
			title: "Retry Feed",
			group: "Research",
			reason: "temporary failure",
		};
		await wrapper.setProps({
			message: "新增 1，复用 0，失败 1",
			opmlImportResult: {
				message: "done",
				imported: 1,
				reused: 0,
				failed: 1,
				failed_sources: [failure],
			},
		});

		const input = wrapper.find('input[type="file"]');
		Object.defineProperty(input.element, "files", {
			value: [file],
			configurable: true,
		});
		await input.trigger("change");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "导出 OPML")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "重试")!
			.trigger("click");

		expect(wrapper.text()).toContain("新增 1，复用 0，失败 1");
		expect(wrapper.emitted("import-opml")).toEqual([[file]]);
		expect(wrapper.emitted("export-opml")).toEqual([[]]);
		expect(wrapper.emitted("retry-opml-failure")).toEqual([[failure]]);
	});

	it("emits batch management and source read-state actions", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");
		await wrapper.get(".subscription-select input").setValue(true);
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "静音")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "全部已读")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "全部未读")!
			.trigger("click");

		expect(wrapper.emitted("batch-update-subscriptions")).toEqual([
			[["sub-1"], { is_muted: true }],
		]);
		expect(wrapper.emitted("mark-subscription-read-state")).toEqual([
			["sub-1", true],
			["sub-1", false],
		]);
	});

	it("emits subscription pause actions", async () => {
		const wrapper = mountSheet();
		await wrapper
			.get('[data-test="subscription-manage-tab-sources"]')
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "暂停")!
			.trigger("click");

		expect(wrapper.emitted("set-subscription-paused")).toEqual([
			["sub-1", true],
		]);
	});

	it("emits group rename and delete actions", async () => {
		const wrapper = mountSheet();

		await wrapper.get('[data-test="group-name-input"]').setValue("技术观察");
		await wrapper.get('[data-test="group-name-input"]').trigger("blur");
		await wrapper
			.get(".group-manage-row")
			.findAll("button")
			.find((button) => button.text() === "删除")!
			.trigger("click");
		const confirmButton = Array.from(
			document.body.querySelectorAll<HTMLButtonElement>(
				".p-modal-footer button",
			),
		).find((button) => button.textContent?.trim() === "删除");
		expect(confirmButton).toBeDefined();
		confirmButton!.click();
		await nextTick();

		expect(wrapper.emitted("rename-group")).toEqual([["group-1", "技术观察"]]);
		expect(wrapper.emitted("delete-group")).toEqual([["group-1"]]);
	});

	it("keeps only hidden keyword local controls and emits keyword updates", async () => {
		const wrapper = mountSheet();

		await wrapper
			.get('[data-test="subscription-manage-tab-keywords"]')
			.trigger("click");
		await wrapper.get('[data-test="filter-keyword-input"]').setValue("剧透");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "添加关键词")!
			.trigger("click");

		expect(wrapper.emitted("update-filter-rules")).toEqual([
			[{ mutedSourceIds: [], hiddenKeywords: ["剧透"] }],
		]);
		expect(wrapper.text()).not.toContain("静音来源");
		expect(wrapper.text()).not.toContain("自动已读来源");
		expect(wrapper.text()).not.toContain("自动稍后阅读来源");
	});

	it("shows subscription rules summary and emits rule management events", async () => {
		const wrapper = mountSheet();

		await wrapper
			.get('[data-test="subscription-manage-tab-rules"]')
			.trigger("click");

		expect(wrapper.text()).toContain("规则管理");
		expect(wrapper.text()).toContain("播客自动整理");
		expect(wrapper.text()).toContain("已启用");
		expect(wrapper.text()).toContain("podcast");
		expect(wrapper.text()).toContain("最近一次应用");
		expect(wrapper.text()).toContain("扫描 12");
		expect(wrapper.text()).toContain("更新 5");

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "新建规则")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "重算全部订阅")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "上移")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "下移")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "编辑")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "应用到已有订阅")!
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "删除规则")!
			.trigger("click");
		const confirmButton = Array.from(
			document.body.querySelectorAll<HTMLButtonElement>(
				".p-modal-footer button",
			),
		).find((button) => button.textContent?.trim() === "删除");
		expect(confirmButton).toBeDefined();
		confirmButton!.click();
		await nextTick();

		expect(wrapper.emitted("create-rule")).toEqual([[]]);
		expect(wrapper.emitted("apply-all-rules")).toEqual([[]]);
		expect(wrapper.emitted("move-rule-up")).toEqual([["rule-1"]]);
		expect(wrapper.emitted("move-rule-down")).toEqual([["rule-1"]]);
		expect(wrapper.emitted("edit-rule")).toEqual([["rule-1"]]);
		expect(wrapper.emitted("apply-rule")).toEqual([["rule-1"]]);
		expect(wrapper.emitted("delete-rule")).toEqual([["rule-1"]]);
	});

	it("opens the rule editor and emits save when editor confirms payload", async () => {
		const wrapper = mount(SubscriptionManageSheet, {
			...mountSheet().props(),
			props: {
				...mountSheet().props(),
			},
			global: {
				stubs: {
					PSheet: { template: "<div><slot /></div>" },
					PField: {
						props: ["label"],
						template: "<label><span>{{ label }}</span><slot /></label>",
					},
					SubscriptionRuleEditorSheet: {
						props: ["show", "mode", "groups", "rule"],
						emits: ["close", "submit"],
						template:
							"<div v-if=\"show\" data-test=\"rule-editor\" :data-mode=\"mode\" @click=\"$emit('submit', { name: '新闻静音', enabled: true, match_type: 'source_category', conditions_json: { categories: ['news'] }, action_group_id: 'group-1', action_muted: true, action_auto_mark_read: false, action_auto_add_reading_list: false })\" />",
					},
				},
			},
		});

		await wrapper
			.get('[data-test="subscription-manage-tab-rules"]')
			.trigger("click");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "编辑")!
			.trigger("click");
		await wrapper.get('[data-test="rule-editor"]').trigger("click");

		expect(wrapper.emitted("save-rule")).toEqual([
			[
				{
					id: "rule-1",
					payload: {
						name: "新闻静音",
						enabled: true,
						match_type: "source_category",
						conditions_json: { categories: ["news"] },
						action_group_id: "group-1",
						action_muted: true,
						action_auto_mark_read: false,
						action_auto_add_reading_list: false,
					},
				},
			],
		]);
	});

	it("shows active hidden keywords and does not expose legacy local source automation controls", async () => {
		const wrapper = mount(SubscriptionManageSheet, {
			...mountSheet().props(),
			props: {
				show: true,
				busy: false,
				healthChecking: false,
				subscriptionRules: [],
				ruleApplySummary: null,
				filterRules: {
					hiddenKeywords: ["剧透"],
					mutedSourceIds: ["source-1"],
				},
				automationRules: {
					autoMarkReadSourceIds: ["source-1"],
					autoAddReadingListSourceIds: ["source-1"],
				},
				groups: [
					{
						id: "group-1",
						user_id: "user-1",
						name: "默认分组",
						created_at: "2026-06-17T00:00:00Z",
						updated_at: "2026-06-17T00:00:00Z",
					},
				],
				subscriptions: [
					{
						id: "sub-1",
						user_id: "user-1",
						feed_source_id: "source-1",
						title: "Example Feed",
						subscription_group_id: "group-1",
						created_at: "2026-06-17T00:00:00Z",
						feed_source: {
							id: "source-1",
							source_type: "external_rss",
							rss_url: "https://example.com/feed.xml",
							hash: "source-1",
							title: "Example Feed",
							created_at: "2026-06-17T00:00:00Z",
						},
					},
				],
			},
			global: {
				stubs: {
					PSheet: { template: "<div><slot /></div>" },
					PField: {
						props: ["label"],
						template: "<label><span>{{ label }}</span><slot /></label>",
					},
				},
			},
		});

		await wrapper
			.get('[data-test="subscription-manage-tab-keywords"]')
			.trigger("click");

		expect(wrapper.text()).toContain("剧透");
		expect(wrapper.text()).not.toContain("已静音来源");
		expect(wrapper.text()).not.toContain("自动已读来源");
		expect(wrapper.text()).not.toContain("自动稍后阅读来源");
		expect(wrapper.text()).not.toContain("取消静音");
		expect(wrapper.text()).not.toContain("取消自动已读");
		expect(wrapper.text()).not.toContain("取消自动稍后阅读");

		await wrapper.get('[data-test="hidden-keyword-chip"]').trigger("click");

		expect(wrapper.emitted("update-filter-rules")).toEqual([
			[{ mutedSourceIds: ["source-1"], hiddenKeywords: [] }],
		]);
	});
});
