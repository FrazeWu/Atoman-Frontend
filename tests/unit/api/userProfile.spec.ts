import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getUserAvatarRestoreAvailability,
	restoreUserAvatar,
	uploadUserAvatar,
} from "../../../src/api/userProfile";

describe("user profile API", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("uploads an avatar with the user avatar purpose", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: { url: "https://cdn.example.com/users/avatar.png" },
						}),
						{ status: 201, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		const file = new File(["avatar"], "avatar.png", { type: "image/png" });

		const result = await uploadUserAvatar(file);

		expect(result.url).toBe("https://cdn.example.com/users/avatar.png");
		const [url, init] = vi.mocked(fetch).mock.calls[0]!;
		expect(url).toBe("/api/v1/uploads");
		expect(init).toMatchObject({ method: "POST", credentials: "include" });
		const body = init?.body as FormData;
		expect(body.get("file")).toBe(file);
		expect(body.get("purpose")).toBe("user.avatar");
	});

	it("checks and restores the previous avatar", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ data: { available: true } }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ data: { url: "https://cdn.example.com/users/avatars/user-1/new" } }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
		vi.stubGlobal("fetch", fetchMock);

		await expect(getUserAvatarRestoreAvailability()).resolves.toEqual({ available: true });
		await expect(restoreUserAvatar()).resolves.toEqual({ url: "https://cdn.example.com/users/avatars/user-1/new" });

		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/uploads/avatar/restore-available");
		expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/uploads/avatar/restore");
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", credentials: "include" });
	});
});
