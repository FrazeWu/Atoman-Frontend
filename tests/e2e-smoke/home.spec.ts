import { expect, test } from "@playwright/test";

test("home shell renders without a backend dependency", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("#app")).toBeVisible();
});
