import { type Page, expect } from "@playwright/test";

export async function waitForNetworkIdle(
	page: Page,
	timeout = 10000,
): Promise<void> {
	try {
		await page.waitForLoadState("networkidle", { timeout });
	} catch {
		// Network idle is best-effort for pages with persistent connections.
	}
}

export async function expectTextVisible(
	page: Page,
	text: string,
): Promise<void> {
	await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

export async function expectUrlContains(
	page: Page,
	fragment: string,
): Promise<void> {
	await expect(page).toHaveURL(new RegExp(fragment));
}

export async function fillAndSubmit(
	page: Page,
	selector: string,
	value: string,
): Promise<void> {
	await page.locator(selector).fill(value);
}

export async function clickAndWaitForNavigation(
	page: Page,
	locator:
		| ReturnType<Page["locator"]>
		| ReturnType<Page["getByRole"]>
		| ReturnType<Page["getByText"]>,
): Promise<void> {
	const previousURL = page.url();
	const navigation = page.waitForURL((url) => url.toString() !== previousURL, {
		timeout: 15000,
	});
	await locator.click();
	try {
		await navigation;
	} catch {
		// Some controls update content without changing the URL.
	}
}
