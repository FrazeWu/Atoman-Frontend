import { expect, test } from "../fixtures/base";

function envelope(data: unknown) {
	return JSON.stringify({ data });
}

const songDescription = Array.from(
	{ length: 80 },
	() => "Optional song description",
).join(" ");

const songDetail = {
	song: {
		id: "song-e2e-1",
		title: "Standalone Song",
		description: songDescription,
		release_type: "single",
		release_date: "2025-01-02",
		release_date_precision: "day",
		cover_url: "https://img.example.test/song-cover.jpg",
		audio_url: "https://audio.example.test/song.mp3",
		sources: [{ type: "url", url: "https://example.test/song-source" }],
		status: "open",
		entry_status: "open",
		lifecycle_status: "active",
		edit_status: "development",
		artists: [{ id: "artist-e2e-1", name: "E2E Artist" }],
	},
	artists: [
		{ id: "artist-e2e-1", name: "E2E Artist", role: "primary", position: 1 },
	],
	playable: true,
};

test("独立歌曲复用发行编辑器并通过歌曲修订保存", async ({ page }) => {
	const revisionBodies: Array<{ changes?: Record<string, unknown> }> = [];

	await page.setViewportSize({ width: 1000, height: 900 });
	await page.route("**/api/v1/**", async (route) => {
		const request = route.request();
		let path = "";
		try {
			path = new URL(request.url()).pathname;
		} catch {
			await route.abort("failed");
			return;
		}

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
		if (request.method() === "GET" && path === "/api/v1/music/songs/song-e2e-1") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: envelope(songDetail),
			});
			return;
		}
		if (
			request.method() === "GET" &&
			path === "/api/v1/music/songs/song-e2e-1/lyrics"
		) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: envelope({
					song_id: "song-e2e-1",
					version: 1,
					content: "",
					translation: "",
					format: "plain",
					language: "",
					lines: [],
					annotations: [],
				}),
			});
			return;
		}
		if (
			request.method() === "POST" &&
			path === "/api/v1/songs/song-e2e-1/revisions"
		) {
			revisionBodies.push(
				request.postDataJSON() as { changes?: Record<string, unknown> },
			);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: envelope({ id: "revision-e2e-1", status: "approved" }),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: envelope([]),
		});
	});
	await page.route("https://img.example.test/song-cover.jpg", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "image/png",
			body: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
				"base64",
			),
		});
	});

	await page.goto("/music/song/song-e2e-1");
	const songDialog = page.getByRole("dialog", { name: /歌曲/ });
	await expect(
		songDialog.getByRole("heading", { name: "Standalone Song" }),
	).toBeVisible();
	const detailDescription = songDialog.locator("#song-description");
	const detailDescriptionToggle = songDialog.getByTestId(
		"song-description-toggle",
	);
	await expect(detailDescription).toHaveText(songDescription);
	await expect
		.poll(() =>
			detailDescription.evaluate(
				(element) => element.scrollHeight > element.clientHeight + 1,
			),
		)
		.toBe(true);
	await expect(detailDescriptionToggle).toHaveAttribute(
		"aria-expanded",
		"false",
	);
	await detailDescriptionToggle.click();
	await expect(detailDescriptionToggle).toHaveAttribute("aria-expanded", "true");
	await expect(detailDescription).toHaveText(songDescription);

	await songDialog
		.locator(".song-detail__actions")
		.getByRole("button", { name: "编辑", exact: true })
		.click();

	const editor = page.getByRole("dialog", { name: "编辑歌曲" });
	await expect(editor.getByTestId("album-details-progress-label")).toHaveText(
		"编辑歌曲",
	);
	await expect(editor.getByTestId("album-details-title-input")).toHaveValue(
		"Standalone Song",
	);
	await expect(editor.getByTestId("album-details-date-input")).toHaveValue(
		"2025/01/02",
	);
	await expect(editor.getByTestId("album-details-source-input")).toHaveValue(
		"https://example.test/song-source",
	);
	expect(await editor.getByTestId("album-details-bio-toggle").count()).toBe(0);
	await expect(editor.getByTestId("album-details-bio-input")).toHaveValue(
		songDescription,
	);
	await expect(editor.locator('textarea[aria-label="歌词"]')).toHaveCount(0);
	await expect(editor.getByText("碟号", { exact: true })).toHaveCount(0);
	await expect(editor.getByText("曲序", { exact: true })).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await expect
		.poll(() =>
			editor
				.locator(".album-details-step")
				.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
		)
		.toBe(true);
	await expect(editor.getByTestId("album-details-date-input")).toHaveValue(
		"2025/01/02",
	);

	await editor.getByRole("button", { name: "保存", exact: true }).click();
	await expect.poll(() => revisionBodies.length).toBe(1);
	const changes = revisionBodies[0]?.changes ?? {};
	expect(changes).toMatchObject({
		title: "Standalone Song",
		description: songDescription,
		release_type: "single",
		release_date: "2025-01-02",
		sources: [{ type: "url", url: "https://example.test/song-source" }],
	});
	expect(changes).not.toHaveProperty("lyrics");
	expect(changes).not.toHaveProperty("track_number");
	expect(changes).not.toHaveProperty("disc_number");
});
