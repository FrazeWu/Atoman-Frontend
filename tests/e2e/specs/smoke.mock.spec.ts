import { expect, test } from "@playwright/test";

test.describe("CI smoke", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/v1/**", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			const path = url.pathname;
			const method = request.method();
			const fulfill = (body: unknown, status = 200) =>
				route.fulfill({
					status,
					contentType: "application/json",
					body: JSON.stringify(body),
				});

			if (path === "/api/v1/auth/session") {
				return route.fulfill({ status: 204, body: "" });
			}
			if (path === "/api/v1/site/access") {
				return fulfill({
					modules: {
						feed: { enabled: true, features: {} },
						blog: { enabled: true, features: {} },
						studio: { enabled: true, features: {} },
					},
				});
			}
			if (path === "/api/v1/feed/recommend/channels") {
				return fulfill({ data: [] });
			}
			if (path === "/api/v1/feed/recommend/articles") {
				return fulfill({ data: [] });
			}
			if (path === "/api/v1/feed/recommend/themes") {
				return fulfill({ data: [] });
			}
			if (path === "/api/v1/feed/subscriptions") {
				return fulfill({ data: [] });
			}
			if (path === "/api/v1/feed/timeline") {
				return fulfill({
					data: [],
					meta: { page: 1, page_size: 20, total: 0, has_more: false },
				});
			}
			if (path === "/api/v1/studio/state") {
				return fulfill({
					data: {
						current_channel: {
							id: "channel-1",
							name: "主频道",
							slug: "main",
							description: "",
							cover_url: "",
						},
						channels: [
							{
								id: "channel-1",
								name: "主频道",
								slug: "main",
								description: "",
								cover_url: "",
							},
						],
					},
				});
			}
			if (path === "/api/v1/studio/dashboard") {
				return fulfill({
					data: {
						channel_subscriber_count: 0,
						sections: ["blog", "podcast", "video"].map((module) => ({
							module,
							metrics: {
								contents: 0,
								published: 0,
								drafts: 0,
								view: 0,
								play: 0,
								complete: 0,
								comment: 0,
								like: 0,
								bookmark: 0,
								share: 0,
							},
							recent: [],
							issues: [],
						})),
					},
				});
			}
			if (path === "/api/v1/studio/goals" && method === "GET") {
				return fulfill({
					data: {
						current_cycle: null,
						cycles: [],
						metrics: [],
					},
				});
			}
			if (path === "/api/v1/site/visits") return fulfill({}, 204);
			return fulfill({ data: [] });
		});
	});

	test("loads login route", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
	});

	test("loads feed route with empty state", async ({ page }) => {
		await page.goto("/feed");
		await expect(page).toHaveURL(/\/feed(?:\?.*)?$/);
	});

	test("loads studio route for authenticated session", async ({ page }) => {
		await page.unroute("**/api/v1/auth/session");
		await page.route("**/api/v1/auth/session", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					csrf_token: "smoke-csrf-token",
					user: {
						uuid: "smoke-user",
						username: "smoke",
						email: "smoke@example.com",
						role: "user",
					},
				}),
			}),
		);
		await page.goto("/studio");
		await expect(page).toHaveURL(/\/studio(?:\?.*)?$/);
		await expect(page.locator(".studio-layout")).toBeVisible();
	});
});
