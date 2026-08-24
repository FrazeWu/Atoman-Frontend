import { test, expect } from "../fixtures/base";

const hasIsolatedMusicFixture =
  process.env.MUSIC_WIKI_REAL_E2E === "1" &&
  process.env.MUSIC_WIKI_ISOLATED_ACCOUNT === "1";

test.describe("Music Wiki Real", () => {
  test.skip(
    !hasIsolatedMusicFixture,
    "requires MUSIC_WIKI_REAL_E2E=1 and an isolated music test account",
  );

  test("authenticated user can traverse the core music surfaces", async ({
    authenticatedPage,
  }) => {
    const surfaces = [
      { path: "/music", heading: "发现" },
      { path: "/music/me", heading: "我的" },
      { path: "/music/playlists", heading: "歌单" },
      { path: "/music/history", heading: "播放历史" },
    ];

    await authenticatedPage.goto("/music");
    await expect(
      authenticatedPage.getByRole("heading", { name: "发现" }),
    ).toBeVisible();
    const firstAlbum = authenticatedPage
      .locator('[data-testid="personalized-album-card"], [data-testid="discover-album-card"]')
      .first();
    await expect(firstAlbum).toBeVisible();
    await firstAlbum.click();

    await expect(authenticatedPage.locator('[data-testid="album-play-action"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="album-play-action"]')).toBeEnabled();
    await authenticatedPage.locator('[data-testid="album-play-action"]').click();
    await expect(authenticatedPage.locator(".player-title")).toBeVisible();

    const firstTrack = authenticatedPage.locator(".track-title").first();
    await expect(firstTrack).toBeVisible();
    await firstTrack.click();
    await expect(authenticatedPage).toHaveURL(/\/music\/song\//);
    await authenticatedPage.goBack();

    for (const surface of surfaces.slice(1)) {
      await authenticatedPage.goto(surface.path);
      await expect(
        authenticatedPage.getByRole("heading", { name: surface.heading }),
      ).toBeVisible();
      await expect(authenticatedPage.getByText("页面不存在")).not.toBeVisible();
    }
  });

  test("authenticated user can traverse the core music surfaces on mobile", async ({
    authenticatedMobilePage,
  }) => {
    for (const surface of [
      { path: "/music", heading: "发现" },
      { path: "/music/me", heading: "我的" },
      { path: "/music/playlists", heading: "歌单" },
      { path: "/music/history", heading: "播放历史" },
    ]) {
      await authenticatedMobilePage.goto(surface.path);
      await expect(
        authenticatedMobilePage.getByRole("heading", { name: surface.heading }),
      ).toBeVisible();
      await expect(authenticatedMobilePage.getByText("页面不存在")).not.toBeVisible();
    }
  });

  test("authenticated user can open the music contribute flow against real backend", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/artist/new");

    await expect(authenticatedPage.getByText("添加/补全艺术家")).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "创建艺术家" }),
    ).toBeVisible();
  });
});
