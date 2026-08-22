import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/base";
import { mockAuthenticatedSession } from "../helpers/auth";

const testChannel = {
	id: "channel-1",
	name: "测试频道",
	slug: "test",
	description: "",
	cover_url: "",
};

async function mockBlogAuthor(page: Page) {
	await mockAuthenticatedSession(page, {
		uuid: "user-1",
		username: "admin",
		email: "admin@example.com",
		role: "admin",
		onboarding_completed_at: "2026-07-15T09:00:00Z",
	});
	await page.route("**/api/v1/studio/state", (route) =>
		route.fulfill({
			status: 200,
			json: { data: { current_channel: testChannel, channels: [testChannel] } },
		}),
	);
	await page.route("**/api/v1/studio/blog/collections", (route) =>
		route.fulfill({ status: 200, json: { data: [] } }),
	);
	await page.route("**/api/v1/studio/blog/settings", (route) =>
		route.fulfill({
			status: 200,
			json: {
				data: {
					channel_id: testChannel.id,
					module: "blog",
					default_visibility: "public",
					default_publish_status: "draft",
				},
			},
		}),
	);
}

test.describe("Blog", () => {
	test("browse blog home page", async ({ page }) => {
		await page.goto("/posts");
		await expect(page).toHaveURL(/\/posts$/);
		await expect(
			page.getByRole("heading", { name: "发现", exact: true }),
		).toBeVisible();
	});

	test("create new post as authenticated user", async ({
		authenticatedPage,
	}) => {
		await mockBlogAuthor(authenticatedPage);
		await authenticatedPage.goto("/studio/blog/new");
		await expect(authenticatedPage).toHaveURL(/\/studio\/blog\/new$/);
		const saveBtn = authenticatedPage.getByRole("button", { name: "存草稿" });
		const publishBtn = authenticatedPage.getByRole("button", { name: "发布" });
		await expect(saveBtn).toBeVisible({ timeout: 10000 });
		await expect(publishBtn).toBeVisible({ timeout: 10000 });
	});

	test("bookmark page accessible as authenticated user", async ({
		authenticatedPage,
	}) => {
		await mockBlogAuthor(authenticatedPage);
		await authenticatedPage.goto("/posts/bookmarks");
		await expect(authenticatedPage).toHaveURL(/\/posts\/bookmarks$/);
		await expect(
			authenticatedPage.getByRole("heading", { name: "收藏", exact: true }),
		).toBeVisible();
	});

	test("visit blog settings page", async ({ authenticatedPage }) => {
		await mockBlogAuthor(authenticatedPage);
		await authenticatedPage.goto("/users/admin/settings");
		await expect(authenticatedPage).toHaveURL(/\/users\/admin\/settings$/);
		await expect(
			authenticatedPage.getByRole("heading", { name: "账号设置", exact: true }),
		).toBeVisible();
	});

	test("editor uses the workbench compose workflow", async ({
		authenticatedPage,
	}) => {
		await mockBlogAuthor(authenticatedPage);
		await authenticatedPage.goto("/studio/blog/new");
		await expect(authenticatedPage).toHaveURL(/\/studio\/blog\/new$/);

		await authenticatedPage.waitForSelector(".editor-shell", {
			timeout: 10000,
		});
		await expect(
			authenticatedPage.getByText("新建文章", { exact: true }),
		).toBeVisible();
		await expect(
			authenticatedPage.getByRole("button", { name: "存草稿" }),
		).toBeVisible();
		await expect(
			authenticatedPage.getByRole("button", { name: "发布" }),
		).toBeVisible();
	});
});
