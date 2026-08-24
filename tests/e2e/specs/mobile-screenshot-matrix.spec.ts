import { test, expect } from "../fixtures/base";

const mobileRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/modules",
  "/inbox",
  "/feed",
  "/feed/sources",
  "/feed/subscriptions",
  "/feed/reading-list",
  "/feed/starred",
  "/feed/item/feed-item-1",
  "/posts",
  "/posts/notes",
  "/posts/notes/note-1",
  "/posts/notes/note-1/edit",
  "/posts/subscriptions",
  "/posts/bookmarks",
  "/post/post-1",
  "/posts/post/post-1",
  "/channel/demo",
  "/posts/channel/demo",
  "/channels/demo",
  "/channels/demo/posts",
  "/channels/demo/about",
  "/collection/collection-1",
  "/users/demo",
  "/users/demo/posts",
  "/users/demo/channels",
  "/music",
  "/music/discover",
  "/music/songs",
  "/music/playlists",
  "/music/bookmarks",
  "/music/history",
  "/music/me",
  "/music/player",
  "/music/lyrics",
  "/music/artist/artist-1",
  "/music/album/album-1",
  "/music/song/song-1",
  "/music/playlist/playlist-1",
  "/studio",
  "/studio/channel",
  "/studio/channel/collections",
  "/studio/blog/content",
  "/studio/blog/collections",
  "/studio/blog/imports",
  "/studio/blog/analytics",
  "/studio/blog/interactions",
  "/studio/blog/settings",
  "/studio/blog/new",
  "/studio/blog/content-1/edit",
] as const;

const listMeta = { page: 1, page_size: 100, total: 0, has_more: false };
const coverDataURL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='%23007AFF'/%3E%3C/svg%3E";
const user = { uuid: "mobile-test-user", username: "mobile-test", email: "mobile-test@example.com" };

function listResponse(data: unknown[] = []) {
  return { data, meta: { ...listMeta, total: data.length } };
}

function detailResponse(pathname: string) {
  if (pathname.includes("/music/albums/")) {
    return { id: "album-1", title: "测试专辑", cover_url: "", artists: [], songs: [] };
  }
  if (pathname.includes("/music/artists/")) {
    return { id: "artist-1", name: "测试艺人", image_url: "", albums: [], songs: [] };
  }
  if (pathname.includes("/music/songs/")) {
    return {
      song: { id: "song-1", title: "测试歌曲", audio_url: "", cover_url: coverDataURL, artists: [], album: null },
      artists: [],
      playable: false,
    };
  }
  if (pathname.includes("/music/playlists/")) {
    return { id: "playlist-1", name: "测试歌单", cover_url: "", song_count: 0, songs: [] };
  }
  if (pathname.includes("/blog/channels")) {
    return { id: "channel-1", name: "测试频道", slug: "demo", description: "", posts: [] };
  }
  if (pathname.includes("/blog/collections")) {
    return { id: "collection-1", name: "测试合集", description: "", posts: [] };
  }
  if (pathname.includes("/short-notes/")) {
    return {
      id: "note-1",
      content: "测试短文",
      media: [],
      likes_count: 0,
      comments_count: 0,
      liked: false,
      edited: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      user,
    };
  }
  if (pathname.includes("/blog/posts")) {
    return { id: "post-1", title: "测试文章", content: "", user };
  }
  if (pathname.includes("/users/")) {
    return { uuid: user.uuid, username: user.username, email: user.email, posts: [], channels: [] };
  }
  return {};
}

async function mockMobileApi(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/**", async (route) => {
    const requestURL = new URL(route.request().url());
    const pathname = requestURL.pathname;
    let body: unknown = listResponse();

    if (pathname.endsWith("/auth/session")) {
      body = { csrf_token: "mobile-test-csrf", user };
    } else if (pathname.endsWith("/site/access")) {
      body = {
        modules: {
          feed: { enabled: true, features: {} },
          blog: { enabled: true, features: {} },
          music: { enabled: true, features: {} },
          podcast: { enabled: true, features: {} },
          video: { enabled: true, features: {} },
          forum: { enabled: true, features: {} },
          debate: { enabled: true, features: {} },
          timeline: { enabled: true, features: {} },
        },
      };
    } else if (pathname.endsWith("/music/playlists/public")) {
      body = listResponse([{ id: "playlist-public", name: "公开歌单", kind: "user", cover_url: coverDataURL, song_count: 2 }]);
    } else if (pathname.endsWith("/music/playlists")) {
      body = listResponse([
        { id: "playlist-own", name: "我的夜行歌单", kind: "user", cover_url: coverDataURL, song_count: 3 },
        { id: "playlist-favorite", name: "最爱", kind: "favorite", cover_url: coverDataURL, song_count: 5 },
      ]);
    } else if (pathname.endsWith("/music/bookmarks/playlists")) {
      body = listResponse([
        { id: "bookmark-1", playlist_id: "playlist-saved", playlist: { id: "playlist-saved", name: "收藏歌单", kind: "user", cover_url: coverDataURL, song_count: 4 } },
      ]);
    } else if (pathname.endsWith("/music/bookmarks/albums")) {
      body = listResponse([{ id: "album-bookmark-1", album_id: "album-1", album: { id: "album-1", title: "收藏专辑", cover_url: coverDataURL, artists: [] } }]);
    } else if (pathname.endsWith("/music/bookmarks/artists")) {
      body = listResponse([{ id: "artist-bookmark-1", artist_id: "artist-1", artist: { id: "artist-1", name: "收藏艺人", image_url: coverDataURL } }]);
    } else if (pathname.endsWith("/music/albums")) {
      body = listResponse([{ id: "album-1", title: "测试专辑", cover_url: coverDataURL, artists: [], songs: [] }]);
    } else if (pathname.endsWith("/music/artists")) {
      body = listResponse([{ id: "artist-1", name: "测试艺人", image_url: coverDataURL, albums: [] }]);
    } else if (pathname.endsWith("/music/songs")) {
      body = listResponse([{ id: "song-1", title: "测试歌曲", audio_url: "", cover_url: coverDataURL, artists: [] }]);
    } else if (pathname.endsWith("/music/library")) {
      body = requestURL.searchParams.get("kind") === "playlist"
        ? listResponse([{ id: "bookmark-1", playlist_id: "playlist-saved", playlist: { id: "playlist-saved", name: "收藏歌单", kind: "user", cover_url: coverDataURL, song_count: 4 } }])
        : listResponse();
    } else if (pathname.endsWith("/music/home")) {
      body = { data: { personalized: false, recently_played: [], for_you: [] } };
    } else if (/\/music\/playlists\/[^/]+\/songs$/.test(pathname)) {
      body = listResponse();
    } else if (pathname.includes("/blog/channels") && pathname.includes("/collections")) {
      body = listResponse();
    } else if (/\/(music|blog)?\/?short-notes\//.test(pathname) || /\/(music|blog)\/(albums|artists|songs|playlists|channels|posts)\//.test(pathname)) {
      body = { data: detailResponse(pathname) };
    } else if (pathname.includes("/users/")) {
      body = { data: detailResponse(pathname) };
    } else if (/\/(music|blog)\/(album|artist|song|playlist|channel|collection|post|users)\//.test(pathname)) {
      body = { data: detailResponse(pathname) };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

function routeSlug(pathname: string) {
  return pathname.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
}

test.describe("Mobile route screenshot matrix", () => {
  test.describe.configure({ mode: "serial", timeout: 30_000 });

  for (const pathname of mobileRoutes) {
    test(`renders ${pathname} without mobile layout regressions`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockMobileApi(page);
      const runtimeErrors: string[] = [];
      const failedScripts: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("response", (response) => {
        const contentType = response.headers()["content-type"] || "";
        if (response.request().resourceType() === "script" && (response.status() >= 400 || contentType.includes("text/html"))) {
          failedScripts.push(`${response.status()} ${response.url()} ${contentType}`);
        }
      });

      await page.goto(pathname, { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname, `${pathname} was redirected`).toBe(pathname);
      await expect(page.locator("html[data-atoman-app=mobile]")).toHaveCount(1);
      await expect(page.locator(".mobile-app-shell")).toBeVisible();
      await page.waitForTimeout(450);
      await expect(page.locator(".mobile-app-main")).not.toBeEmpty();

      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyHeight: document.body.scrollHeight,
      }));
      expect(layout.scrollWidth, `${pathname} has horizontal overflow`).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.bodyHeight, `${pathname} rendered no document`).toBeGreaterThan(0);
      expect(failedScripts, `${pathname} loaded an invalid script`).toEqual([]);
      expect(runtimeErrors, `${pathname} emitted runtime errors`).toEqual([]);

      await page.screenshot({ path: testInfo.outputPath(`mobile-${routeSlug(pathname)}.png`), fullPage: true });
    });
  }

  test("keeps playlist covers visible at the target mobile widths", async ({ page }, testInfo) => {
    await mockMobileApi(page);
    for (const width of [390, 393, 430]) {
      await page.setViewportSize({ width, height: width === 430 ? 932 : width === 393 ? 852 : 844 });
      await page.goto("/music/playlists", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="owned-playlist-card"] img')).toHaveCount(2);
      await expect(page.locator('[data-testid="bookmarked-playlist-card"] img')).toHaveCount(1);
      const loadedCovers = await page.locator('[data-testid="owned-playlist-card"] img').evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0));
      expect(loadedCovers, `${width}px playlist covers did not load`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`mobile-playlists-${width}.png`), fullPage: true });
    }
  });

  test("renders playlist covers in the desktop library list", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockMobileApi(page);
    await page.goto("/music/bookmarks", { waitUntil: "domcontentloaded" });
    await page.getByRole("radio", { name: "歌单", exact: true }).click();
    await expect(page.locator('[data-testid="library-playlist-card"] img')).toHaveCount(2);
    const loadedCovers = await page.locator('[data-testid="library-playlist-card"] img').evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0));
    expect(loadedCovers).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("desktop-music-playlists.png"), fullPage: true });
  });
});
