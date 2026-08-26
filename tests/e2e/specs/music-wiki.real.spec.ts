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
      { path: "/music/playlists", heading: "收藏" },
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

  test("authenticated user can create, reload, and delete a private playlist", async ({
    authenticatedMusicPage,
  }) => {
    const playlistName = `E2E playlist ${Date.now()}`;
    let playlistUrl = "";

    try {
      await authenticatedMusicPage.goto("/music");
      const createButton = authenticatedMusicPage.locator(
        '.music-sidebar-playlists:not(.is-collapsed) button[title="新建歌单"]',
      );
      await expect(createButton).toBeVisible();
      await createButton.click();

      const nameInput = authenticatedMusicPage.getByPlaceholder("输入歌单名称...");
      await expect(nameInput).toBeVisible();
      await nameInput.fill(playlistName);
      await nameInput.press("Enter");
      await expect(authenticatedMusicPage).toHaveURL(/\/music\/playlist\/[^/]+$/);
      playlistUrl = authenticatedMusicPage.url();
      await expect(
        authenticatedMusicPage.locator('[data-testid="playlist-edit-button"]'),
      ).toBeVisible();
      await expect(authenticatedMusicPage.locator(".playlist-title")).toHaveText(
        playlistName,
      );

      await authenticatedMusicPage.reload();
      await expect(authenticatedMusicPage.locator(".playlist-title")).toHaveText(
        playlistName,
      );

      await authenticatedMusicPage.goto("/music");
      await expect(
        authenticatedMusicPage
          .locator(".music-sidebar-playlists__item")
          .filter({ hasText: playlistName }),
      ).toBeVisible();
    } finally {
      if (playlistUrl) {
        try {
          await authenticatedMusicPage.goto(playlistUrl);
          const editButton = authenticatedMusicPage.locator(
            '[data-testid="playlist-edit-button"]',
          );
          if (await editButton.count()) {
            await editButton.click();
            const deleteButton = authenticatedMusicPage.locator(
              '[data-testid="playlist-delete-button"]',
            );
            await expect(deleteButton).toBeVisible();
            await deleteButton.click();
            const confirmation = authenticatedMusicPage.getByRole("dialog", {
              name: "删除歌单",
            });
            await expect(confirmation).toBeVisible();
            await confirmation
              .getByRole("button", { name: "删除", exact: true })
              .click();
            await expect(authenticatedMusicPage).not.toHaveURL(/\/music\/playlist\//);
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
      { path: "/music/playlists", heading: "收藏" },
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
    await authenticatedMusicPage.goto("/music/artist/new");

    const creationDialog = authenticatedMusicPage.getByRole("dialog", {
      name: "创建艺术家",
    });
    await expect(creationDialog).toBeVisible();
    await expect(
      creationDialog.getByRole("textbox", { name: "本名*" }),
    ).toBeVisible();
    await expect(
      creationDialog.getByRole("button", { name: "创建专辑/歌曲" }),
    ).toBeVisible();
  });
});
