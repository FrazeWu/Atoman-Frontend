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
    await authenticatedMusicPage
      .locator('[data-testid="album-play-action"]')
      .click();
    await expect(authenticatedMusicPage.locator(".player-title")).toBeVisible();

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
});
