import { expect, test } from "../fixtures/base";

const longTitle = "比过苏轼！华云龙无敌了！华云龙KLE LinboiRivch 罗可Lorkin《泪忘书》如果有来生我下次，我还会接过你的球棒的 001";

type ImportStatus = "uploaded" | "needs_attention" | "committed" | "canceled";

function importRecord(status: ImportStatus, importId: string, title: string) {
	return {
		importId,
		targetAlbumId: status === "committed" ? `album-${importId}` : "",
		albumTitle: title,
		status,
		archiveName: `${title}.mp3`,
		uploadProgress: 100,
		uploadSpeed: 0,
		coverUrl: "",
		coverKey: "",
		derivedAlbumTitle: title,
		derivedCover: "",
		derivedTracks: [
			{
				title: `${title} 曲目`,
				audioKey: `${importId}.mp3`,
				origin: "import",
			},
		],
		lastSyncedAt: "2026-08-24T17:21:00Z",
		errorMessage: status === "needs_attention" ? "at least one source is required" : "",
		inputMode: "archive",
		stage: status === "needs_attention" ? "ready" : "completed",
		progress: { current: 1, total: 1 },
		files: [],
		errors: [],
	};
}

function envelope(data: unknown, meta?: unknown) {
	return JSON.stringify(meta ? { data, meta } : { data });
}

test("导入中心在四个状态分组中保持列表和详情边界", async ({ page }) => {
	const records = [
		importRecord("uploaded", "import-progress", `${longTitle} 进行中`),
		importRecord("needs_attention", "import-attention", `${longTitle} 需处理`),
		importRecord("committed", "import-published", `${longTitle} 已发布`),
		importRecord("canceled", "import-canceled", `${longTitle} 已取消`),
	];

	await page.setViewportSize({ width: 1440, height: 960 });
	await page.route("**/api/v1/**", async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;

		if (request.method() === "GET" && path === "/api/v1/auth/session") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					csrf_token: "e2e-csrf",
					user: {
						uuid: "user-e2e",
						username: "e2e-user",
						email: "e2e@example.test",
						role: "user",
					},
				}),
			});
			return;
		}

		if (request.method() === "GET" && path === "/api/v1/music/imports/albums") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: envelope(records, {
					page: 1,
					page_size: 50,
					total: records.length,
					has_more: false,
				}),
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: envelope([]),
		});
	});

	await page.goto("/music/imports");
	const layout = page.locator(".music-imports-view__layout");
	const list = page.locator(".music-imports-view__list");
	const detail = page.locator(".music-imports-view__detail");
	await expect(layout).toBeVisible({ timeout: 15_000 });

	for (const testCase of [
		{ label: "进行中", title: `${longTitle} 进行中`, action: "继续导入" },
		{ label: "需处理", title: `${longTitle} 需处理`, action: "处理问题" },
		{ label: "已发布", title: `${longTitle} 已发布`, action: "修复资料" },
		{ label: "已取消", title: `${longTitle} 已取消`, action: "删除记录" },
	]) {
		const tab = page.getByRole("tab", { name: new RegExp(`^${testCase.label} 1$`) });
		await tab.click();
		await expect(tab).toHaveAttribute("aria-selected", "true");
		await expect(detail.getByRole("heading", { name: testCase.title })).toBeVisible();
		await expect(detail.getByRole("button", { name: testCase.action })).toBeVisible();
		await expect
			.poll(() =>
				layout.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
			)
			.toBe(true);
	}

	const [listBox, detailBox] = await Promise.all([list.boundingBox(), detail.boundingBox()]);
	expect(listBox).not.toBeNull();
	expect(detailBox).not.toBeNull();
	expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(detailBox!.x + 1);
	expect(Math.abs(listBox!.y - detailBox!.y)).toBeLessThanOrEqual(1);

	await page.setViewportSize({ width: 390, height: 844 });
	const mobileOverflow = await page.evaluate(() => {
		const viewportWidth = window.innerWidth;
		return {
			viewportWidth,
			documentWidth: document.documentElement.scrollWidth,
			offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
				.map((element) => {
					const rect = element.getBoundingClientRect();
					return {
						className: element.className,
						tagName: element.tagName,
						left: Math.round(rect.left),
						right: Math.round(rect.right),
					};
				})
				.filter((element) => element.left < -1 || element.right > viewportWidth + 1)
				.slice(0, 12),
		};
	});
	expect(
		mobileOverflow.documentWidth,
		JSON.stringify(mobileOverflow.offenders),
	).toBeLessThanOrEqual(mobileOverflow.viewportWidth);
	const [mobileListBox, mobileDetailBox] = await Promise.all([
		list.boundingBox(),
		detail.boundingBox(),
	]);
	expect(mobileListBox).not.toBeNull();
	expect(mobileDetailBox).not.toBeNull();
	expect(mobileDetailBox!.y).toBeGreaterThanOrEqual(mobileListBox!.y + mobileListBox!.height - 1);
});
