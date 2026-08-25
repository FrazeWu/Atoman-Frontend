import { test, expect } from "../fixtures/base";

const hasIsolatedMusicFixture =
  process.env.MUSIC_WIKI_REAL_E2E === "1" &&
  process.env.MUSIC_WIKI_ISOLATED_ACCOUNT === "1" &&
  Boolean(process.env.MUSIC_WIKI_AUTH_FILE);

test.describe("Music Wiki Real", () => {
  test.skip(
    !hasIsolatedMusicFixture,
    "requires MUSIC_WIKI_REAL_E2E=1, MUSIC_WIKI_AUTH_FILE and an isolated music test account",
  );

  test("authenticated user can traverse the core music surfaces", async ({
    authenticatedMusicPage,
  }) => {
    const surfaces = [
      { path: "/music", heading: "发现" },
      { path: "/music/me", heading: "我的" },
      { path: "/music/playlists", heading: "歌单" },
      { path: "/music/history", heading: "播放历史" },
    ];

    await authenticatedMusicPage.goto("/music");
    await expect(
      authenticatedMusicPage.getByRole("heading", { name: "发现" }),
    ).toBeVisible();
    const firstAlbum = authenticatedMusicPage
      .locator('[data-testid="personalized-album-card"], [data-testid="discover-album-card"]')
      .first();
    await expect(firstAlbum).toBeVisible();
    await firstAlbum.click();

    await expect(
      authenticatedMusicPage.locator('[data-testid="album-play-action"]'),
    ).toBeVisible();
    await expect(
      authenticatedMusicPage.locator('[data-testid="album-play-action"]'),
    ).toBeEnabled();
    await authenticatedMusicPage
      .locator('[data-testid="album-play-action"]')
      .click();
    await expect(authenticatedMusicPage.locator(".player-title")).toBeVisible();

    const firstTrack = authenticatedMusicPage.locator(".track-title").first();
    await expect(firstTrack).toBeVisible();
    await firstTrack.click();
    await expect(authenticatedMusicPage).toHaveURL(/\/music\/song\//);
    await authenticatedMusicPage.goBack();

    for (const surface of surfaces.slice(1)) {
      await authenticatedMusicPage.goto(surface.path);
      await expect(
        authenticatedMusicPage.getByRole("heading", { name: surface.heading }),
      ).toBeVisible();
      await expect(
        authenticatedMusicPage.getByText("页面不存在"),
      ).not.toBeVisible();
    }
  });

  test("authenticated user can persist an album bookmark through the music profile", async ({
    authenticatedMusicPage,
  }) => {
    let albumTitle = "";
    let createdBookmark = false;

    try {
      await authenticatedMusicPage.goto("/music");
      const firstAlbum = authenticatedMusicPage
        .locator('[data-testid="personalized-album-card"], [data-testid="discover-album-card"]')
        .first();
      await expect(firstAlbum).toBeVisible();
      albumTitle = (
        await firstAlbum.locator(".album-title-btn").textContent()
      )?.trim() ?? "";
      expect(albumTitle).toBeTruthy();

      await firstAlbum.click();
      const bookmark = authenticatedMusicPage.locator(
        '[data-testid="album-bookmark-toggle"]',
      );
      await expect(bookmark).toBeVisible();
      const wasBookmarked = (await bookmark.textContent())?.includes("已订阅") ?? false;
      if (!wasBookmarked) {
        await bookmark.click();
        createdBookmark = true;
        await expect(bookmark).toHaveText("已订阅");
      }

      await authenticatedMusicPage.goto("/music/me");
      const profileAlbum = authenticatedMusicPage
        .locator(".music-album-card")
        .filter({ hasText: albumTitle });
      await expect(profileAlbum).toBeVisible();
    } finally {
      if (createdBookmark && albumTitle) {
        try {
          await authenticatedMusicPage.goto("/music/me");
          const profileAlbum = authenticatedMusicPage
            .locator(".music-album-card")
            .filter({ hasText: albumTitle });
          const removeBookmark = profileAlbum.getByRole("button", { name: "取消收藏" });
          if (await removeBookmark.count()) {
            await removeBookmark.click();
          }
        } catch {
          // Preserve the original assertion failure while still attempting cleanup.
        }
      }
    }
  });

  test("authenticated user can traverse the core music surfaces on mobile", async ({
    authenticatedMusicMobilePage,
  }) => {
    for (const surface of [
      { path: "/music", heading: "发现" },
      { path: "/music/me", heading: "我的" },
      { path: "/music/playlists", heading: "歌单" },
      { path: "/music/history", heading: "播放历史" },
    ]) {
      await authenticatedMusicMobilePage.goto(surface.path);
      await expect(
        authenticatedMusicMobilePage.getByRole("heading", {
          name: surface.heading,
        }),
      ).toBeVisible();
      await expect(
        authenticatedMusicMobilePage.getByText("页面不存在"),
      ).not.toBeVisible();
    }
  });

  test("authenticated user can open the music contribute flow against real backend", async ({
    authenticatedMusicPage,
  }) => {
    await authenticatedMusicPage.goto("/artist/new");

    await expect(authenticatedMusicPage.getByText("添加/补全艺术家")).toBeVisible();
    await expect(
      authenticatedMusicPage.getByRole("button", { name: "创建艺术家" }),
    ).toBeVisible();
  });
});
