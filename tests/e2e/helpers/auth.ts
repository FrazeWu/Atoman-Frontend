import type { Page } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_USERNAME || "e2e-owner";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD || "e2e-password";

export async function mockAuthenticatedSession(
	page: Page,
	user: Record<string, unknown> = {
		uuid: "user-1",
		username: "creator",
		email: "creator@example.com",
		role: "user",
		onboarding_completed_at: "2026-07-15T09:00:00Z",
	},
): Promise<void> {
	await page.route("**/api/v1/auth/session", (route) =>
		route.fulfill({
			status: 200,
			json: { csrf_token: "e2e-csrf-token", user },
		}),
	);
}

export async function loginViaUI(
	page: Page,
	email: string,
	password: string,
): Promise<void> {
	await page.goto("/login");
	await page.getByPlaceholder("输入用户名或邮箱").fill(email);
	await page.getByPlaceholder("输入密码").fill(password);
	const loginResponse = page.waitForResponse((response) => {
		if (response.request().method() !== "POST") return false;
		try {
			return new URL(response.url()).pathname === "/api/v1/auth/login";
		} catch {
			return false;
		}
	});
	await page.getByRole("button", { name: "登录" }).click();
	if (!(await loginResponse).ok()) throw new Error("登录失败");
	await page.waitForURL((url) => url.pathname !== "/login");
}

export async function logoutViaUI(page: Page): Promise<void> {
	await page.getByRole("button", { name: /▾/ }).first().click();
	await page.getByRole("button", { name: "退出登录" }).click();
	await page.waitForURL(/\/login/);
}

export { ADMIN_USERNAME, ADMIN_PASSWORD };
