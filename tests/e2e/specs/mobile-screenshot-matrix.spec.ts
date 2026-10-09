import { test, expect as baseExpect } from "../fixtures/base";
import { mobileScreenshotRoutes } from "../helpers/mobile-screenshot-routes";
const expect = baseExpect.configure({ timeout: 20_000 });

const listMeta = { page: 1, page_size: 100, total: 0, has_more: false };
const coverDataURL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='%23007AFF'/%3E%3C/svg%3E";
const user = {
  uuid: "mobile-test-user",
  username: "mobile-test",
  email: "mobile-test@example.com",
};
const book = { id: 'work-1', title: '移动阅读测试作品', authors: [], editions: [], lifecycle_status: 'active', rating_score: 0, rating_count: 0 };
const episode = { id: 'episode-1', audio_url: '', duration_sec: 120, episode_cover_url: coverDataURL, channel: { id: 'show-1', slug: 'demo', name: '移动播客测试节目', cover_url: coverDataURL }, post: { id: 'podcast-post-1', title: '移动播客测试单集', content: '这是一段用于检查手机阅读布局的节目说明。' } };
const forumCategory = { id: 'category-1', name: '交流', color: '#007aff', created_at: '2026-01-01T00:00:00Z' };
const forumTopic = { id: 'topic-1', title: '移动论坛测试话题', content: '这是一段手机话题正文。', category_id: forumCategory.id, category: forumCategory, user_id: user.uuid, user, tags: [], reply_count: 0, like_count: 0, view_count: 0, created_at: '2026-01-01T00:00:00Z' };
const debate = { id: 'debate-1', title: '移动辩论测试辩题', description: '手机阅读与操作布局检查', content: '测试辩题正文。', user_id: user.uuid, user, status: 'active', tags: [], references: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

function listResponse(data: unknown[] = []) {
  return { data, meta: { ...listMeta, total: data.length } };
}

function detailResponse(pathname: string) {
  if (pathname.includes("/music/albums/")) {
    return {
      id: "album-1",
      title: "测试专辑",
      cover_url: "",
      artists: [],
      songs: [
        {
          id: "song-1",
          title: "测试曲目",
          track_number: 1,
          duration_seconds: 210,
          audio_url: "https://example.test/song.mp3",
          artists: [],
        },
        {
          id: "song-2",
          title: "第二首曲目",
          track_number: 2,
          duration_seconds: 185,
          audio_url: "https://example.test/song-2.mp3",
          artists: [],
        },
      ],
    };
  }
  if (pathname.includes("/music/artists/")) {
    return {
      id: "artist-1",
      name: "测试艺人",
      image_url: "",
      albums: [],
      songs: [],
    };
  }
  if (pathname.includes("/music/songs/")) {
    return {
      song: {
        id: "song-1",
        title: "测试歌曲",
        audio_url: "",
        cover_url: coverDataURL,
        artists: [],
        album: null,
      },
      artists: [],
      playable: false,
    };
  }
  if (pathname.includes("/music/playlists/")) {
    return {
      id: "playlist-1",
      name: "测试歌单",
      cover_url: "",
      song_count: 0,
      songs: [],
    };
  }
  if (pathname.includes("/blog/channels")) {
    return {
      id: "channel-1",
      name: "测试频道",
      slug: "demo",
      description: "",
      posts: [],
    };
  }
  if (pathname.includes("/blog/collections")) {
    return { id: "collection-1", name: "测试合集", description: "", posts: [] };
  }
  if (pathname.includes("/short-notes/")) {
    return {
      id: "note-1",
      user_id: user.uuid,
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
    return {
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      posts: [],
      channels: [],
    };
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
          books: { enabled: true, features: { 'books.submit': true } },
          blog: { enabled: true, features: {} },
          music: { enabled: true, features: {} },
          podcast: { enabled: true, features: {} },
          video: { enabled: true, features: {} },
          forum: { enabled: true, features: {} },
          debate: { enabled: true, features: {} },
          timeline: { enabled: true, features: {} },
        },
      };
    } else if (/\/timeline\/(events|persons)$/.test(pathname)) {
      const persons = pathname.endsWith('/persons') ? [{ id: 'person-1', name: '移动时间线测试人物', tags: [], locations: [] }] : [];
      body = { data: persons, total: persons.length, page: Number(requestURL.searchParams.get('page') || 1), limit: Number(requestURL.searchParams.get('limit') || 200) };
    } else if (pathname.endsWith('/podcast/episodes')) {
      body = [episode];
    } else if (pathname.endsWith('/podcast/episodes/episode-1')) {
      body = episode;
    } else if (pathname.endsWith('/podcast/shows/demo/episodes')) {
      body = { channel: episode.channel, episodes: [episode] };
    } else if (pathname.endsWith('/forum/categories')) {
      body = { data: [forumCategory] };
    } else if (pathname.endsWith('/forum/topics')) {
      body = { data: [forumTopic], meta: { ...listMeta, page_size: 20, total: 1 } };
    } else if (pathname.endsWith('/forum/topics/topic-1')) {
      body = { data: forumTopic };
    } else if (pathname.endsWith('/debate/topics')) {
      body = listResponse([debate]);
    } else if (pathname.endsWith('/debate/topics/debate-1')) {
      body = { data: debate };
    } else if (pathname.endsWith('/debate/topics/debate-1/votes')) {
      body = { data: { yes_votes: 0, no_votes: 0, total_votes: 0, current_direction: '', current_user_vote: '' } };
    } else if (pathname.endsWith('/timeline/persons/person-1')) {
      body = { data: { id: 'person-1', name: '移动时间线测试人物', bio: '用于检查人物信息和地图布局。', tags: [], locations: [] } };
    } else if (pathname.endsWith('/books/assets/asset-1/content')) {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: '移动阅读测试正文。\n'.repeat(100) });
      return;
    } else if (pathname.endsWith('/books/assets/asset-1')) {
      body = { data: { id: 'asset-1', title: '移动阅读测试正文', file_name: 'mobile.txt', format: 'txt', processing_status: 'private_available' } };
    } else if (pathname.endsWith('/books/assets/asset-1/reading-state')) {
      body = { data: { asset_id: 'asset-1', pdf_page: 1, txt_offset: 0, reading_percent: 0, preferences: {} } };
    } else if (pathname.endsWith('/books/catalog/works/work-1')) {
      body = { data: book };
    } else if (pathname.endsWith('/books/catalog/editions/edition-1')) {
      body = { data: { work: book, edition: { id: 'edition-1', work_id: book.id, title: '移动阅读测试版本', publisher: '测试出版社' } } };
    } else if (pathname.endsWith('/books/catalog/search')) {
      body = { data: { items: [book], total: 1, limit: 20, offset: 0 } };
    } else if (pathname.includes('/books/')) {
      body = { data: /\/(imports|continue)$/.test(pathname) ? [] : { items: [], total: 0, limit: 20, offset: 0 } };
    } else if (pathname.endsWith("/music/playlists/public")) {
      body = listResponse([
        {
          id: "playlist-public",
          name: "公开歌单",
          kind: "user",
          cover_url: coverDataURL,
          song_count: 2,
        },
      ]);
    } else if (pathname.endsWith("/music/playlists")) {
      body = listResponse([
        {
          id: "playlist-own",
          name: "我的夜行歌单",
          kind: "user",
          cover_url: coverDataURL,
          song_count: 3,
        },
        {
          id: "playlist-favorite",
          name: "最爱",
          kind: "favorite",
          cover_url: coverDataURL,
          song_count: 5,
        },
      ]);
    } else if (pathname.endsWith("/music/bookmarks/playlists")) {
      body = listResponse([
        {
          id: "bookmark-1",
          playlist_id: "playlist-saved",
          playlist: {
            id: "playlist-saved",
            name: "收藏歌单",
            kind: "user",
            cover_url: coverDataURL,
            song_count: 4,
          },
        },
      ]);
    } else if (pathname.endsWith("/music/bookmarks/albums")) {
      body = listResponse([
        {
          id: "album-bookmark-1",
          album_id: "album-1",
          album: {
            id: "album-1",
            title: "收藏专辑",
            cover_url: coverDataURL,
            artists: [],
          },
        },
      ]);
    } else if (pathname.endsWith("/music/bookmarks/artists")) {
      body = listResponse([
        {
          id: "artist-bookmark-1",
          artist_id: "artist-1",
          artist: { id: "artist-1", name: "收藏艺人", image_url: coverDataURL },
        },
      ]);
    } else if (pathname.endsWith("/music/albums")) {
      body = listResponse([
        {
          id: "album-1",
          title: "测试专辑",
          cover_url: coverDataURL,
          artists: [],
          songs: [],
        },
      ]);
    } else if (pathname.endsWith("/music/artists")) {
      body = listResponse([
        {
          id: "artist-1",
          name: "测试艺人",
          image_url: coverDataURL,
          albums: [],
        },
      ]);
    } else if (pathname.endsWith("/music/songs")) {
      body = listResponse([
        {
          id: "song-1",
          title: "测试歌曲",
          audio_url: "",
          cover_url: coverDataURL,
          artists: [],
        },
      ]);
    } else if (pathname.endsWith("/music/library")) {
      body =
        requestURL.searchParams.get("kind") === "playlist"
          ? listResponse([
              {
                id: "bookmark-1",
                playlist_id: "playlist-saved",
                playlist: {
                  id: "playlist-saved",
                  name: "收藏歌单",
                  kind: "user",
                  cover_url: coverDataURL,
                  song_count: 4,
                },
              },
            ])
          : listResponse();
    } else if (pathname.endsWith("/music/home")) {
      body = {
        data: { personalized: false, recently_played: [], for_you: [] },
      };
    } else if (pathname.endsWith('/videos')) {
      const videos = [{ id: 'video-1', title: '测试视频', thumbnail_url: coverDataURL, duration_sec: 120, tags: [], view_count: 0, created_at: '2026-01-01T00:00:00Z' }];
      body = requestURL.searchParams.has('collection_id') ? videos : listResponse(videos);
    } else if (pathname.endsWith('/feed/stats')) {
      body = { data: { period: 'week', total_read: 0, points: [], source_breakdown: [] } };
    } else if (pathname.endsWith("/videos/video-1/recommended")) {
      body = [];
    } else if (pathname.endsWith("/videos/video-1")) {
      body = {
        id: "video-1",
        title: "测试视频",
        description: "用于移动端截图验证的视频详情。",
        video_url: "https://example.test/video",
        thumbnail_url: "",
        storage_type: "external",
        duration_sec: 120,
        visibility: "public",
        view_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        tags: [],
        collections: [],
      };
    } else if (/\/music\/playlists\/[^/]+\/songs$/.test(pathname)) {
      body = listResponse();
    } else if (
      pathname.includes("/blog/channels") &&
      pathname.includes("/collections")
    ) {
      body = listResponse();
    } else if (
      /\/(music|blog)?\/?short-notes\//.test(pathname) ||
      /\/(music|blog)\/(albums|artists|songs|playlists|channels|posts)\//.test(
        pathname,
      )
    ) {
      body = { data: detailResponse(pathname) };
    } else if (pathname.includes("/users/")) {
      body = { data: detailResponse(pathname) };
    } else if (
      /\/(music|blog)\/(album|artist|song|playlist|channel|collection|post|users)\//.test(
        pathname,
      )
    ) {
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
  return (
    pathname
      .replace(/^\//, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "home"
  );
}

test.describe("Mobile route screenshot matrix", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ actionTimeout: 20_000 });

  for (const pathname of mobileScreenshotRoutes) {
    test(`renders ${pathname} without mobile layout regressions`, async ({
      page,
    }, testInfo) => {
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
        if (
          response.request().resourceType() === "script" &&
          (response.status() >= 400 || contentType.includes("text/html"))
        ) {
          failedScripts.push(
            `${response.status()} ${response.url()} ${contentType}`,
          );
        }
      });

      await page.goto(pathname, { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname, `${pathname} was redirected`).toBe(
        pathname,
      );
      await expect(page.locator("html[data-atoman-app=mobile]")).toHaveCount(1);
      await expect(page.locator(".mobile-app-shell")).toBeVisible();
      await expect(page.locator(".mobile-app-main")).not.toBeEmpty({
        timeout: 10_000,
      });
      const expectedContent: Record<string, string> = {
        '/books': '移动阅读测试作品',
        '/books/work/work-1': '移动阅读测试作品',
        '/books/edition/edition-1': '移动阅读测试版本',
        '/books/read/asset-1': '移动阅读测试正文',
        '/podcasts': '移动播客测试单集',
        '/podcasts/show/demo': '移动播客测试节目',
        '/podcasts/episode/episode-1': '移动播客测试单集',
        '/forum': '移动论坛测试话题',
        '/forum/topic/topic-1': '移动论坛测试话题',
        '/debate': '移动辩论测试辩题',
        '/debate/debate-1': '移动辩论测试辩题',
        '/timeline/person/person-1': '移动时间线测试人物',
      };
      if (expectedContent[pathname]) await expect(page.getByText(expectedContent[pathname], { exact: true }).first()).toBeVisible();
      if (pathname === '/forum/new') await expect(page.locator('.cm-editor')).toBeVisible();
      if (pathname === '/posts/notes/note-1/edit') await expect(page.locator('.short-note-composer')).toBeVisible();
      if (pathname === '/feed/subscriptions') {
        const mode = page.locator('[data-test="timeline-mode-chronological"]');
        await expect(mode).toBeVisible();
        const lines = await mode.locator('.p-segmented-control-label').evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        });
        expect(lines, '订阅筛选文字被挤成竖排').toBe(1);
      }
      if (pathname === '/timeline/person/person-1') {
        await expect(page.locator('.ol-viewport')).toBeVisible();
        await expect(page.locator('.ol-zoom')).toHaveCSS('position', 'absolute');
      }

      const shouldShowBottomNav =
        !/^\/(?:login|register|forgot-password)$/.test(pathname) &&
        pathname !== "/";
      if (shouldShowBottomNav) {
        await expect(
          page.locator(".mobile-bottom-nav__bar"),
          `${pathname} lost the mobile bottom navigation`,
        ).toBeVisible();
        const firstTab = page.locator('.mobile-bottom-nav__tab').first();
        const hit = await firstTab.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
        });
        expect(hit, `${pathname} bottom navigation is covered`).toBe(true);
      }

      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyHeight: document.body.scrollHeight,
      }));
      expect(
        layout.scrollWidth,
        `${pathname} has horizontal overflow`,
      ).toBeLessThanOrEqual(layout.viewportWidth);
      expect(
        layout.bodyHeight,
        `${pathname} rendered no document`,
      ).toBeGreaterThan(0);
      expect(failedScripts, `${pathname} loaded an invalid script`).toEqual([]);
      expect(runtimeErrors, `${pathname} emitted runtime errors`).toEqual([]);

      if (pathname === "/feed") {
        const featuredTitle = page.getByRole("heading", {
          name: "精选文章",
          exact: true,
        });
        await expect(featuredTitle).toBeVisible();
        const titleBox = await featuredTitle.boundingBox();
        expect(
          titleBox,
          `${pathname} featured title is missing`,
        ).not.toBeNull();
        expect(
          titleBox!.height,
          `${pathname} featured title wrapped vertically`,
        ).toBeLessThanOrEqual(32);
      }

      if (/^\/music\/(?:artist|album|playlist)\//.test(pathname)) {
        await expect(page.locator(".mobile-bottom-nav__bar")).toBeVisible();
        const sheetContent = page.locator(".p-sheet-mobile-page__content");
        const sheetMetrics = await sheetContent.evaluate((element) => ({
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }));
        expect(sheetMetrics.scrollWidth, pathname + " detail content has horizontal overflow").toBeLessThanOrEqual(sheetMetrics.clientWidth);
        const navTab = page.locator('[data-tab-key="discover"]');
        const navBox = await navTab.boundingBox();
        expect(navBox, `${pathname} bottom navigation has no layout`).not.toBeNull();
        const navHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".mobile-bottom-nav__tab")?.getAttribute("data-tab-key"), {
          x: navBox!.x + navBox!.width / 2,
          y: navBox!.y + navBox!.height / 2,
        });
        expect(navHit, `${pathname} detail sheet covers the bottom navigation`).toBe("discover");
      }

      if (pathname === "/music/album/album-1") {
        const track = page.locator('[data-testid="track-play-song-1"]').locator("..");
        await expect(track).toBeVisible();
        const trackMetrics = await track.evaluate((element) => ({
          right: element.getBoundingClientRect().right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }));
        expect(trackMetrics.right, pathname + " track row exceeds the viewport").toBeLessThanOrEqual(390);
        expect(trackMetrics.scrollWidth, pathname + " track row has horizontal overflow").toBeLessThanOrEqual(trackMetrics.clientWidth);
      }

      const mobileContentSelectors: Record<string, string> = {
        "/music/discover": ".music-explore-view",
        "/music/songs": ".songs-view",
        "/music/bookmarks": ".music-library",
        "/music/history": ".music-history-view",
      };
      const contentSelector = mobileContentSelectors[pathname];
      if (contentSelector) {
        const contentMetrics = await page
          .locator(contentSelector)
          .evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              paddingLeft: Number.parseFloat(style.paddingLeft),
              paddingRight: Number.parseFloat(style.paddingRight),
            };
          });
        expect(
          contentMetrics.paddingLeft,
          `${pathname} content has no mobile inset`,
        ).toBeGreaterThanOrEqual(12);
        expect(
          contentMetrics.paddingRight,
          `${pathname} content has no mobile inset`,
        ).toBeGreaterThanOrEqual(12);
      }

      await page.screenshot({
        animations: 'disabled',
        path: testInfo.outputPath(`mobile-${routeSlug(pathname)}.png`),
        fullPage: true,
      });
    });
  }

  test('keeps new module content usable at 320px and returns from details', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await mockMobileApi(page);
    const journeys = [
      ['/books', '/books/work/work-1', '.books-detail'],
      ['/podcasts', '/podcasts/episode/episode-1', '.pev-wrap'],
      ['/forum', '/forum/topic/topic-1', '.topic-header'],
      ['/debate', '/debate/debate-1', '.debate-header'],
      ['/timeline/persons', '/timeline/person/person-1', '.person-panel'],
      ['/videos', '/videos/watch/video-1', '.p-sheet-mobile-page__content'],
    ];
    for (const [home, detail, selector] of journeys) {
      await page.goto(home!);
      await expect(page.locator('.mobile-module-layout')).toBeVisible();
      await page.evaluate(() => document.querySelector('.mobile-module-layout')?.setAttribute('data-retained', 'yes'));
      if (home === '/timeline/persons') await page.getByText('移动时间线测试人物', { exact: true }).click();
      else await page.locator(`a[href="${detail}"]`).first().click();
      await expect(page.locator(selector!)).toBeVisible();
      if (home === '/timeline/persons') await expect(page.locator('.ol-viewport')).toBeVisible();
      await expect(page.locator('.mobile-module-layout')).toHaveAttribute('data-retained', 'yes');
      const bounds = await page.locator(selector!).evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth, right: element.getBoundingClientRect().right, overflow: [...element.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > window.innerWidth).slice(0, 12).map(child => ({ class: child.className, right: child.getBoundingClientRect().right })) }));
      expect(bounds.scroll, `${detail} ${JSON.stringify(bounds.overflow)}`).toBeLessThanOrEqual(bounds.width + 1);
      expect(bounds.right, detail).toBeLessThanOrEqual(320);
      await expect(page.locator('.mobile-bottom-nav__bar')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`narrow-${routeSlug(detail!)}.png`), fullPage: true, animations: 'disabled' });
      const back = home === '/videos' ? page.locator('.p-sheet-mobile-page__back') : page.getByRole('button', { name: '返回上一页', exact: true });
      await back.click();
      await expect(page).toHaveURL(new RegExp(home + '$'));
    }
  });

  test('opens mobile Studio editors with a real channel layout', async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMobileApi(page);
    const channel = { id: 'channel-1', slug: 'demo', name: '移动创作测试频道', description: '', cover_url: '' };
    await page.route('**/api/v1/studio/state', (route) => route.fulfill({ json: { data: { current_channel: channel, channels: [channel] } } }));
    for (const module of ['blog', 'podcast', 'video']) {
      await page.goto(`/studio/${module}/content`);
      await expect(page.locator('[data-testid="create-content"]')).toBeVisible();
      await page.locator('[data-testid="create-content"]').click();
      await expect(page).toHaveURL(new RegExp(`/studio/${module}/new$`));
      await expect(page.locator('.studio-route-sheet')).toBeVisible();
      if (module === 'blog') {
        await expect.poll(async () => runtimeErrors.length > 0 || await page.locator('.p-editor').isVisible(), { timeout: 20_000 }).toBe(true);
        expect(runtimeErrors).toEqual([]);
        await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 20_000 });
      }
      if (module === 'podcast') await expect(page.locator('.pe-drop-zone')).toBeVisible();
      if (module === 'video') await expect(page.locator('.ve-wrap')).toBeVisible();
      expect(runtimeErrors).toEqual([]);
      await expect(page.locator('.mobile-bottom-nav__bar')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`studio-${module}-editor.png`), fullPage: true, animations: 'disabled' });
      await page.locator('.studio-route-sheet').getByRole('button', { name: /关闭/ }).first().click();
      await expect(page).toHaveURL(new RegExp(`/studio/${module}/content$`));
    }
  });

  test("navigates through the mobile bottom tabs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockMobileApi(page);

    await page.goto("/feed", { waitUntil: "domcontentloaded" });
    await page.locator('[data-tab-key="reading-list"]').click();
    await expect(page).toHaveURL(/\/feed\/reading-list$/);
    await expect(page.locator('[data-tab-key="reading-list"]')).toHaveClass(/is-active/);

    await page.goto("/modules", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".mobile-bottom-nav__bar")).toBeVisible();
    await page.locator('[data-tab-key="music"]').click();
    await expect(page).toHaveURL(/\/music$/);

    await page.locator('[data-tab-key="more"]').click();
    await expect(page).toHaveURL(/\/music\/more$/);
    await expect(page.locator('[data-tab-key="more"]')).toHaveClass(/is-active/);
  });

  test("keeps playlist covers visible at the target mobile widths", async ({
    page,
  }, testInfo) => {
    await mockMobileApi(page);
    for (const width of [390, 393, 430]) {
      await page.setViewportSize({
        width,
        height: width === 430 ? 932 : width === 393 ? 852 : 844,
      });
      await page.goto("/music/playlists", { waitUntil: "domcontentloaded" });
      await expect(
        page.locator('[data-testid="owned-playlist-card"] img'),
      ).toHaveCount(2);
      await expect(
        page.locator('[data-testid="bookmarked-playlist-card"] img'),
      ).toHaveCount(1);
      const loadedCovers = await page
        .locator('[data-testid="owned-playlist-card"] img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        );
      expect(loadedCovers, `${width}px playlist covers did not load`).toBe(
        true,
      );
      await page.screenshot({
        path: testInfo.outputPath(`mobile-playlists-${width}.png`),
        fullPage: true,
      });
    }
  });

  test('keeps desktop module layouts separate from mobile navigation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockMobileApi(page);
    for (const pathname of ['/books', '/podcasts', '/videos', '/forum', '/debate', '/timeline']) {
      await page.goto(pathname);
      await expect(page.locator('html[data-atoman-app=desktop]')).toHaveCount(1);
      await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);
      await expect(page.locator('.mobile-module-layout')).toHaveCount(0);
      await expect(page.locator('.a-main-content')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`desktop-${routeSlug(pathname)}.png`), fullPage: true });
    }
  });

  test("renders playlist covers in the desktop library list", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockMobileApi(page);
    await page.goto("/music/bookmarks", { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-atoman-app=desktop]')).toHaveCount(1);
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);
    await page.getByRole("radio", { name: "歌单", exact: true }).click();
    await expect(
      page.locator('[data-testid="library-playlist-card"] img'),
    ).toHaveCount(2);
    const loadedCovers = await page
      .locator('[data-testid="library-playlist-card"] img')
      .evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      );
    expect(loadedCovers).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("desktop-music-playlists.png"),
      fullPage: true,
    });
  });
});
