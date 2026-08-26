import { test, expect } from "../fixtures/base";

test.describe("Music player real browser", () => {
  const hasIsolatedMusicFixture =
    process.env.MUSIC_WIKI_REAL_E2E === "1" &&
    process.env.MUSIC_WIKI_ISOLATED_ACCOUNT === "1" &&
    Boolean(process.env.MUSIC_WIKI_AUTH_FILE);

  test.skip(
    !hasIsolatedMusicFixture,
    "requires MUSIC_WIKI_REAL_E2E=1, MUSIC_WIKI_AUTH_FILE and an isolated music test account",
  );

  test("restores the paused queue and current song after a browser reload", async ({
    authenticatedMusicPage,
  }) => {
    await authenticatedMusicPage.addInitScript(() => {
      const NativeAudio = window.Audio;
      const instances: HTMLAudioElement[] = [];
      const browserWindow = window as typeof window & {
        __atomanAudioInstances?: HTMLAudioElement[];
      };
      browserWindow.__atomanAudioInstances = instances;

      browserWindow.Audio = function testAudio(src?: string) {
        const audio = new NativeAudio(src);
        const mutableAudio = audio as HTMLAudioElement & {
          play: () => Promise<void>;
          pause: () => void;
        };
        mutableAudio.play = () => {
          audio.dispatchEvent(new Event("playing"));
          return Promise.resolve();
        };
        mutableAudio.pause = () => {
          audio.dispatchEvent(new Event("pause"));
        };
        instances.push(audio);
        return audio;
      } as unknown as typeof Audio;
    });

    await authenticatedMusicPage.goto("/music");
    const firstAlbum = authenticatedMusicPage
      .locator('[data-testid="personalized-album-card"], [data-testid="discover-album-card"]')
      .first();
    await expect(firstAlbum).toBeVisible();
    await firstAlbum.click();

    await expect(
      authenticatedMusicPage.locator('[data-testid="album-play-action"]'),
    ).toBeVisible();
    const playbackSessionSave = authenticatedMusicPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/v1\/music\/playback-session(?:\?|$)/.test(response.url()) &&
        response.ok(),
      { timeout: 15000 },
    );
    await authenticatedMusicPage
      .locator('[data-testid="album-play-action"]')
      .click();
    await expect(authenticatedMusicPage.locator(".player-title")).toBeVisible();
    await playbackSessionSave;

    const currentTitle = await authenticatedMusicPage
      .locator(".player-title")
      .textContent();
    const queueCount = await authenticatedMusicPage
      .locator(".queue-count")
      .textContent();
    expect(currentTitle?.trim()).toBeTruthy();
    expect(queueCount).toBeTruthy();

    await authenticatedMusicPage.reload();
    await expect(authenticatedMusicPage.locator(".player-title")).toHaveText(
      currentTitle!.trim(),
    );
    await expect(authenticatedMusicPage.locator(".queue-count")).toHaveText(
      queueCount!.trim(),
    );
    await expect(
      authenticatedMusicPage.locator(".main-play-btn[aria-label='播放']"),
    ).toBeVisible();
  });

  test("records a played song in listening history after the threshold", async ({
    authenticatedMusicPage,
  }) => {
    await authenticatedMusicPage.addInitScript(() => {
      const NativeAudio = window.Audio;
      const instances: HTMLAudioElement[] = [];
      const browserWindow = window as typeof window & {
        __atomanAudioInstances?: HTMLAudioElement[];
      };
      browserWindow.__atomanAudioInstances = instances;

      browserWindow.Audio = function testAudio(src?: string) {
        const audio = new NativeAudio(src);
        const mutableAudio = audio as HTMLAudioElement & {
          play: () => Promise<void>;
          pause: () => void;
        };
        mutableAudio.play = () => {
          audio.dispatchEvent(new Event("playing"));
          return Promise.resolve();
        };
        mutableAudio.pause = () => {
          audio.dispatchEvent(new Event("pause"));
        };
        instances.push(audio);
        return audio;
      } as unknown as typeof Audio;
    });

    let historyEndpoint = "";
    const captureHistoryRequest = (request: { method(): string; url(): string }) => {
      if (
        request.method() === "GET" &&
        /\/api\/v1\/music\/history(?:\?|$)/.test(request.url())
      ) {
        historyEndpoint = request.url().split("?")[0];
      }
    };
    authenticatedMusicPage.on("request", captureHistoryRequest);

    try {
      await authenticatedMusicPage.goto("/music/history");
      await expect(
        authenticatedMusicPage.getByRole("heading", { name: "播放历史" }),
      ).toBeVisible();
      await expect.poll(() => historyEndpoint).not.toBe("");

      const clearResponse = await authenticatedMusicPage.evaluate(async (endpoint) => {
      const apiOrigin = new URL(endpoint).origin;
      const sessionResponse = await fetch(
        new URL("/api/v1/auth/session", apiOrigin),
        {
          credentials: "include",
        },
      );
        const session = (await sessionResponse.json()) as { csrf_token?: string };
        const response = await fetch(endpoint, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRF-Token": session.csrf_token ?? "",
          },
        });
        return { status: response.status, body: await response.text() };
      }, historyEndpoint);
      expect(clearResponse.status).toBe(204);

      await authenticatedMusicPage.goto("/music");
      const firstAlbum = authenticatedMusicPage
        .locator('[data-testid="personalized-album-card"], [data-testid="discover-album-card"]')
        .first();
      await expect(firstAlbum).toBeVisible();
      await firstAlbum.click();
      await authenticatedMusicPage
        .locator('[data-testid="album-play-action"]')
        .click();
      await expect(authenticatedMusicPage.locator(".player-title")).toBeVisible();
      const title = (
        await authenticatedMusicPage.locator(".player-title").textContent()
      )?.trim();
      expect(title).toBeTruthy();

      await authenticatedMusicPage.waitForTimeout(5500);
      await authenticatedMusicPage.goto("/music/history");
      await expect(
        authenticatedMusicPage
          .locator('[data-testid="history-row"]')
          .filter({ hasText: title! }),
      ).toBeVisible();
    } finally {
      if (historyEndpoint) {
        try {
          await authenticatedMusicPage.evaluate(async (endpoint) => {
            const apiOrigin = new URL(endpoint).origin;
            const sessionResponse = await fetch(
              new URL("/api/v1/auth/session", apiOrigin),
              {
                credentials: "include",
              },
            );
            const session = (await sessionResponse.json()) as { csrf_token?: string };
            await fetch(endpoint, {
              method: "DELETE",
              credentials: "include",
              headers: {
                "X-CSRF-Token": session.csrf_token ?? "",
              },
            });
          }, historyEndpoint);
        } catch {
          // Preserve the original assertion failure while attempting cleanup.
        }
      }
      authenticatedMusicPage.off("request", captureHistoryRequest);
    }
  });
});
