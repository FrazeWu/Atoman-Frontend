import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

// @ts-expect-error Vue test files are outside the app tsconfig shim scope.
import StudioContentTable from "../../../../src/components/studio/StudioContentTable.vue";
import type { StudioContentItem, StudioModule } from "../../../../src/types";

const item = (module: StudioModule): StudioContentItem => ({
	id: `${module}-1`,
	module,
	channel_id: "channel-1",
	title: "测试内容",
	summary: "",
	cover_url: "",
	status: "published",
	visibility: "public",
	collections: [{ id: "collection-1", name: "默认合集" }],
	duration_sec: module === "blog" ? undefined : 125,
	view_count: 12,
	metrics: {
		view: 12,
		play: 12,
		complete: 8,
		comment: 3,
		like: 4,
		bookmark: 5,
		share: 6,
	},
	processing_status: module === "video" ? "failed" : undefined,
	published_at: "2026-07-18T00:00:00Z",
	created_at: "2026-07-18T00:00:00Z",
	updated_at: "2026-07-18T00:00:00Z",
});

const RouterLink = { props: ["to"], template: '<a :href="to"><slot /></a>' };
const mountTable = (module: StudioModule, content = item(module)) =>
	mount(StudioContentTable, {
		props: { module, items: [content], pagination: null, canReorder: false },
		global: { stubs: { RouterLink } },
	});

describe("StudioContentTable", () => {
	it("renders blog metrics and emits lifecycle actions", async () => {
		const wrapper = mountTable("blog");
		expect(wrapper.get("tbody td:first-child").classes()).toContain(
			"studio-content-table__col-select",
		);

		for (const label of ["阅读", "评论", "点赞", "收藏", "分享", "发布时间"]) {
			expect(wrapper.findAll("th").some((cell) => cell.text() === label)).toBe(
				true,
			);
		}
		await wrapper.get('[data-testid="toggle-status-blog-1"]').trigger("click");
		await wrapper.get('[data-testid="share-blog-1"]').trigger("click");
		await wrapper.get('[data-testid="delete-blog-1"]').trigger("click");
		expect(wrapper.emitted("status")?.[0]).toEqual([item("blog"), "draft"]);
		expect(wrapper.emitted("share")?.[0]).toEqual([item("blog")]);
		expect(wrapper.emitted("delete")?.[0]).toEqual([item("blog")]);
	});

	it("renders scheduled posts and emits cancel schedule", async () => {
		const scheduled = {
			...item("blog"),
			status: "scheduled" as const,
			scheduled_at: "2026-07-20T08:30:00Z",
		};
		const wrapper = mountTable("blog", scheduled);

		expect(wrapper.text()).toContain("定时发布");
		expect(wrapper.text()).toContain("定时");
		await wrapper
			.get('[data-testid="cancel-schedule-blog-1"]')
			.trigger("click");
		expect(wrapper.emitted("cancelSchedule")?.[0]).toEqual([scheduled]);
	});

	it("shows failed blog scheduling details and emits a retry", async () => {
		const failed = {
			...item("blog"),
			status: "draft" as const,
			schedule_status: "failed",
			schedule_attempts: 3,
			schedule_last_error: "发布检查失败",
		};
		const wrapper = mountTable("blog", failed);

		expect(wrapper.text()).toContain("发布失败");
		expect(wrapper.text()).toContain("发布检查失败");
		await wrapper.get('[data-testid="retry-schedule-blog-1"]').trigger("click");
		expect(wrapper.emitted("retrySchedule")?.[0]).toEqual([failed]);
	});

	it("renders podcast and video media operations", () => {
		const podcast = mountTable("podcast");
		expect(podcast.text()).toContain("02:05");
		expect(podcast.find('[data-testid="reupload-podcast-1"]').exists()).toBe(
			true,
		);

		const video = mountTable("video");
		expect(video.text()).toContain("failed");
		expect(video.find('[data-testid="reupload-video-1"]').exists()).toBe(true);
		expect(video.find('[data-testid="reprocess-video-1"]').exists()).toBe(true);
	});

	it("marks historical multi-collection content as needing a collection choice", () => {
		const conflicted = {
			...item("video"),
			collection_conflict: true,
			collections: [
				{ id: "collection-1", name: "默认合集" },
				{ id: "collection-2", name: "专题合集" },
			],
		};
		const wrapper = mountTable("video", conflicted);
		expect(wrapper.get("tbody td:first-child").classes()).toContain(
			"studio-content-table__col-select",
		);
		expect(wrapper.text()).toContain("待确认：默认合集、专题合集");
	});

	it("renders selection column and header checkbox states", async () => {
		const item1 = { ...item("blog"), id: "blog-1" };
		const item2 = { ...item("blog"), id: "blog-2" };

		// None selected
		const wrapperNone = mount(StudioContentTable, {
			props: { module: "blog", items: [item1, item2], pagination: null, selectedIds: [] },
			global: { stubs: { RouterLink } },
		});
		const headerCheckboxNone = wrapperNone.get<HTMLInputElement>("th.studio-content-table__col-select input[type=\"checkbox\"]");
		expect(headerCheckboxNone.element.checked).toBe(false);
		expect(headerCheckboxNone.element.indeterminate).toBe(false);

		// Partially selected (indeterminate)
		const wrapperPartial = mount(StudioContentTable, {
			props: { module: "blog", items: [item1, item2], pagination: null, selectedIds: ["blog-1"] },
			global: { stubs: { RouterLink } },
		});
		const headerCheckboxPartial = wrapperPartial.get<HTMLInputElement>("th.studio-content-table__col-select input[type=\"checkbox\"]");
		expect(headerCheckboxPartial.element.checked).toBe(false);
		expect(headerCheckboxPartial.element.indeterminate).toBe(true);

		// All selected
		const wrapperAll = mount(StudioContentTable, {
			props: { module: "blog", items: [item1, item2], pagination: null, selectedIds: ["blog-1", "blog-2"] },
			global: { stubs: { RouterLink } },
		});
		const headerCheckboxAll = wrapperAll.get<HTMLInputElement>("th.studio-content-table__col-select input[type=\"checkbox\"]");
		expect(headerCheckboxAll.element.checked).toBe(true);
		expect(headerCheckboxAll.element.indeterminate).toBe(false);
	});

	it("emits toggleSelectAll when header checkbox changes", async () => {
		const item1 = { ...item("blog"), id: "blog-1" };
		const item2 = { ...item("blog"), id: "blog-2" };

		// When not all selected, clicking header checkbox emits toggleSelectAll(true)
		const wrapper = mount(StudioContentTable, {
			props: { module: "blog", items: [item1, item2], pagination: null, selectedIds: ["blog-1"] },
			global: { stubs: { RouterLink } },
		});
		const headerCheckbox = wrapper.get("th.studio-content-table__col-select input[type=\"checkbox\"]");
		await headerCheckbox.trigger("change");
		expect(wrapper.emitted("toggleSelectAll")?.[0]).toEqual([true]);

		// When all selected, clicking header checkbox emits toggleSelectAll(false)
		const wrapperAll = mount(StudioContentTable, {
			props: { module: "blog", items: [item1, item2], pagination: null, selectedIds: ["blog-1", "blog-2"] },
			global: { stubs: { RouterLink } },
		});
		const headerCheckboxAll = wrapperAll.get("th.studio-content-table__col-select input[type=\"checkbox\"]");
		await headerCheckboxAll.trigger("change");
		expect(wrapperAll.emitted("toggleSelectAll")?.[0]).toEqual([false]);
	});

	it("emits toggleSelect when row checkbox changes", async () => {
		const item1 = { ...item("blog"), id: "blog-1", title: "第一篇文章" };
		const wrapper = mount(StudioContentTable, {
			props: { module: "blog", items: [item1], pagination: null, selectedIds: [] },
			global: { stubs: { RouterLink } },
		});
		const rowCheckbox = wrapper.get<HTMLInputElement>("tbody td.studio-content-table__col-select input[type=\"checkbox\"]");
		expect(rowCheckbox.attributes("aria-label")).toBe("选择《第一篇文章》");
		expect(rowCheckbox.element.checked).toBe(false);

		await rowCheckbox.setValue(true);
		expect(wrapper.emitted("toggleSelect")?.[0]).toEqual(["blog-1"]);
	});

	it("emits both toggleSelect and selectConflict when a conflicted row is selected", async () => {
		const conflicted = {
			...item("video"),
			id: "video-conflicted",
			collection_conflict: true,
			collections: [
				{ id: "collection-1", name: "默认合集" },
				{ id: "collection-2", name: "专题合集" },
			],
		};
		const wrapper = mount(StudioContentTable, {
			props: { module: "video", items: [conflicted], pagination: null, selectedIds: [] },
			global: { stubs: { RouterLink } },
		});
		const rowCheckbox = wrapper.get("tbody td.studio-content-table__col-select input[type=\"checkbox\"]");
		await rowCheckbox.setValue(true);

		expect(wrapper.emitted("toggleSelect")?.[0]).toEqual(["video-conflicted"]);
		expect(wrapper.emitted("selectConflict")?.[0]).toEqual([conflicted, true]);
	});

	it("does not show sharing for private content", () => {
		const privateItem = { ...item("blog"), visibility: "private" as const };
		const wrapper = mountTable("blog", privateItem);
		expect(wrapper.find('[data-testid="share-blog-1"]').exists()).toBe(false);
		expect(wrapper.find('[data-testid="view-public-blog-1"]').exists()).toBe(false);
	});

	it("links published public blogs to their public page", () => {
		const wrapper = mountTable("blog");
		expect(wrapper.get('[data-testid="view-public-blog-1"]').attributes("href")).toBe("/posts/post/blog-1");
	});
});
