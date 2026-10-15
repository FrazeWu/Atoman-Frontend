# Feed Article Detail UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Feed article reader UI in `FeedArticleSheet.vue` to unify Post and RSS layouts into an Editorial Eyebrow & Integrated Action Strip hierarchy with a zero-shadow, 4px-radius pure white paper theme.

**Architecture:** Unify the article header for both `Post` and `FeedItem` into 4 sequential tiers: (1) Eyebrow meta (`.article-eyebrow`), (2) Headline (`h1.article-headline`), (3) Integrated Action Strip (`.article-action-strip`), and (4) Repositioned cover image (`.article-cover`). Refactor component CSS and `src/assets/feed-reader.css` for strict 4px radius, 0 shadow, and paper styling.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Vite, Pinia, Lucide Vue Next, Vitest.

## Global Constraints

- Absolute 0 shadow: `box-shadow: none !important`.
- Strict 4px border radius: `border-radius: 4px` on all interactive elements and card containers.
- Pure white background `#FFFFFF` for the paper reading experience.
- Maintain 100% passing tests in `FeedArticleSheet.spec.ts` (16 existing tests plus new assertions).
- UI copy must be concise without developer jargon.

---

### Task 1: Unify Editorial Eyebrow (`.article-eyebrow`) across Post and FeedItem

**Files:**
- Modify: `src/components/feed/FeedArticleSheet.vue`
- Modify: `tests/unit/components/feed/FeedArticleSheet.spec.ts`

**Interfaces:**
- Consumes: `article: TimelineItem`, `source: FeedArticleSource`, `articleSource: ComputedRef<FeedArticleSource | null>`, `formatDate`, `feedWordCountLabel`
- Produces: `.article-eyebrow` container containing source trigger (`[data-test="feed-article-source-trigger"]`), author link/label, publication date, reading time/word count, and subtle dot separators (`·`).

- [ ] **Step 1: Write the failing test**

Add unit tests to `tests/unit/components/feed/FeedArticleSheet.spec.ts` testing the unified eyebrow meta structure for both `post` and `feed_item`:

```typescript
	it("renders editorial eyebrow meta for blog post with author and formatted date", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "post",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					post: {
						id: "post-eyebrow-1",
						title: "眉栏测试博文",
						content: "正文内容",
						created_at: "2026-06-20T00:00:00Z",
						user: { username: "author1", display_name: "测试作家" },
					},
				} as any,
			},
			global: {
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});

		const eyebrow = wrapper.get(".article-eyebrow");
		expect(eyebrow.text()).toContain("测试作家");
		expect(eyebrow.text()).toContain("2026年6月20日");
	});

	it("renders editorial eyebrow meta for RSS item with source badge, author, and reading time", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				reader: {
					default_variant: "rss",
					rss: { html: "<p>这是一段包含约一百字的内容测试正文...</p>" },
					full_text: { status: "not_started" },
				},
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-eyebrow-1",
						feed_source_id: "src-1",
						title: "RSS 眉栏测试",
						author: "特约记者",
						feed_source: { id: "src-1", title: "独立先锋报" },
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});

		const eyebrow = wrapper.get(".article-eyebrow");
		expect(eyebrow.text()).toContain("独立先锋报");
		expect(eyebrow.text()).toContain("特约记者");
		expect(eyebrow.text()).toContain("2026年6月20日");
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: FAIL with "Cannot find .article-eyebrow"

- [ ] **Step 3: Write minimal implementation**

In `src/components/feed/FeedArticleSheet.vue`:
1. In the `post` template block, replace `.article-meta` with `.article-eyebrow`:
```html
      <div class="article-eyebrow">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-badge"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <span v-if="source && articleSource" class="article-eyebrow__sep" aria-hidden="true">·</span>
        <a :href="userUrl(article.post.user?.username || '')" class="article-author-link" @click.stop>
          {{ article.post.user?.display_name || article.post.user?.username || '未知作者' }}
        </a>
        <span class="article-eyebrow__sep" aria-hidden="true">·</span>
        <span class="article-eyebrow__date">{{ formatDate(article.published_at || article.post.created_at) }}</span>
      </div>
```
2. In the `feed_item` template block, replace `.article-meta` with `.article-eyebrow`:
```html
      <div class="article-eyebrow">
        <button
          v-if="source && articleSource"
          type="button"
          class="article-source-badge"
          data-test="feed-article-source-trigger"
          @click="emit('open-source')"
        >
          {{ articleSource.title }}
        </button>
        <span v-else class="article-source-badge article-source-badge--static">{{ feedSourceTitle || 'RSS' }}</span>
        <template v-if="article.feed_item.author">
          <span class="article-eyebrow__sep" aria-hidden="true">·</span>
          <span class="article-author-name">{{ article.feed_item.author }}</span>
        </template>
        <span class="article-eyebrow__sep" aria-hidden="true">·</span>
        <span class="article-eyebrow__date">{{ formatDate(article.feed_item.published_at || article.feed_item.fetched_at) }}</span>
        <template v-if="feedWordCountLabel">
          <span class="article-eyebrow__sep" aria-hidden="true">·</span>
          <span class="article-eyebrow__reading-time">{{ feedWordCountLabel }}</span>
        </template>
      </div>
```
3. Add CSS for `.article-eyebrow`, `.article-source-badge`, `.article-author-link`, `.article-eyebrow__sep`, `.article-eyebrow__date`, `.article-eyebrow__reading-time`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: PASS with 18 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedArticleSheet.vue tests/unit/components/feed/FeedArticleSheet.spec.ts
git commit -m "feat(feed): unify editorial eyebrow meta for posts and rss items"
```

---

### Task 2: Implement Headline (`.article-headline`) and Integrated Action Strip (`.article-action-strip`)

**Files:**
- Modify: `src/components/feed/FeedArticleSheet.vue`
- Modify: `tests/unit/components/feed/FeedArticleSheet.spec.ts`

**Interfaces:**
- Consumes: `articleSource`, `showSourceSubscribe`, `sourceSubscribeBusy`, `postBookmarked`, `postInReadingList`, `feedItemStarred`, `isPlayablePodcast`, `isPodcastPlaying`, `showFeedContentModeSwitch`, `feedContentMode`, `feedContentModeOptions`, `feedContentStateLabel`, `commentCount`
- Produces:
  - `h1.article-title.article-headline` immediately under eyebrow.
  - `.article-action-strip` containing `.article-action-strip__left` (Subscribe, Source Link ↗, Play Podcast) and `.article-action-strip__right` (Segmented Mode Switch, Bookmark/Star, Quick Comments Trigger).

- [ ] **Step 1: Write the failing test**

Add test assertions in `tests/unit/components/feed/FeedArticleSheet.spec.ts`:

```typescript
	it("renders integrated action strip with actions grouped left and right", async () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				showSourceSubscribe: true,
				source: {
					type: "external_rss",
					id: "src-action-1",
					title: "科技早报",
					subscribed: false,
				},
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "item-action-1",
						feed_source_id: "src-action-1",
						title: "动作条综合测试",
						link: "https://example.com/tech-news",
						enclosure_url: "https://cdn.example.com/audio.mp3",
						enclosure_type: "audio/mpeg",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});

		const actionStrip = wrapper.get(".article-action-strip");
		expect(actionStrip.find('[data-test="feed-article-subscribe-source"]').exists()).toBe(true);
		expect(actionStrip.find(".article-source-link").exists()).toBe(true);
		expect(actionStrip.find('[data-test="feed-article-play"]').exists()).toBe(true);
		expect(actionStrip.find('[data-test="feed-article-quick-star"]').exists()).toBe(true);
		expect(actionStrip.find('[data-test="feed-article-comments-trigger"]').exists()).toBe(true);

		// Click comments trigger emits / opens comments
		await actionStrip.get('[data-test="feed-article-comments-trigger"]').trigger("click");
		expect(wrapper.findComponent({ name: "CommentSideSheet" }).props("show")).toBe(true);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: FAIL with "Cannot find .article-action-strip"

- [ ] **Step 3: Write minimal implementation**

1. In `src/components/feed/FeedArticleSheet.vue`:
Import `MessageSquare` from `lucide-vue-next`:
```typescript
import { Bookmark, Clock, MessageSquare, Play } from 'lucide-vue-next'
```
2. In the `post` block, render headline then `.article-action-strip`:
```html
      <h1 class="article-title article-headline">{{ article.post.title }}</h1>
      <div class="article-action-strip">
        <div class="article-action-strip__left">
          <PButton
            v-if="showSourceSubscribe && articleSource"
            data-test="feed-article-subscribe-source"
            :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
            :variant="articleSource.subscribed ? 'secondary' : 'primary'"
            :disabled="articleSource.subscribed"
            :loading="sourceSubscribeBusy"
            size="sm"
            loading-text="订阅中..."
            @click="emit('subscribe-source')"
          />
        </div>
        <div class="article-action-strip__right">
          <button
            v-if="article.post.id"
            type="button"
            class="article-action-btn"
            data-test="feed-article-post-bookmark"
            :aria-pressed="postBookmarked"
            @click="togglePostBookmark"
          >
            <Bookmark :size="15" aria-hidden="true" :fill="postBookmarked ? 'currentColor' : 'none'" />
            <span>{{ postBookmarked ? '已收藏' : '收藏' }}</span>
          </button>
          <button
            v-if="article.post.id"
            type="button"
            class="article-action-btn"
            data-test="feed-article-post-readlater"
            :aria-pressed="postInReadingList"
            @click="togglePostReadingList"
          >
            <Clock :size="15" aria-hidden="true" />
            <span>{{ postInReadingList ? '已稍后读' : '稍后读' }}</span>
          </button>
        </div>
      </div>
```
3. In the `feed_item` block:
Render headline then `.article-action-strip`:
```html
      <h1 class="article-title article-headline">{{ article.feed_item.title }}</h1>
      <div class="article-action-strip">
        <div class="article-action-strip__left">
          <PButton
            v-if="showSourceSubscribe && articleSource"
            data-test="feed-article-subscribe-source"
            :label="articleSource.subscribed ? '已订阅' : '订阅来源'"
            :variant="articleSource.subscribed ? 'secondary' : 'primary'"
            :disabled="articleSource.subscribed"
            :loading="sourceSubscribeBusy"
            size="sm"
            loading-text="订阅中..."
            @click="emit('subscribe-source')"
          />
          <PLink
            v-if="article.feed_item.link"
            :href="article.feed_item.link"
            class="article-source-link"
            aria-label="在源站查看"
            title="在源站查看"
            label="前往源站"
          />
          <button
            v-if="isPlayablePodcast"
            type="button"
            class="article-play-button"
            data-test="feed-article-play"
            @click="emitPlayPodcast"
          >
            <Play :size="15" aria-hidden="true" />
            <span>{{ isPodcastPlaying ? '播放中' : '播放播客' }}</span>
          </button>
        </div>
        <div class="article-action-strip__right">
          <PSegmentedControl
            v-if="showFeedContentModeSwitch"
            v-model="feedContentMode"
            class="article-content-switcher"
            aria-label="正文来源"
            :options="feedContentModeOptions"
          />
          <span v-else class="article-content-label">{{ feedContentStateLabel }}</span>
          <button
            type="button"
            class="article-action-btn"
            data-test="feed-article-quick-star"
            :aria-label="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :title="feedItemStarred ? '取消收藏文章' : '收藏文章'"
            :aria-pressed="feedItemStarred"
            @click="toggleFeedItemStar"
          >
            <Bookmark :size="15" aria-hidden="true" :fill="feedItemStarred ? 'currentColor' : 'none'" />
            <span>{{ feedItemStarred ? '已收藏' : '收藏' }}</span>
          </button>
          <button
            type="button"
            class="article-action-btn article-action-btn--comments"
            data-test="feed-article-comments-trigger"
            aria-label="评论"
            @click="openComments"
          >
            <MessageSquare :size="15" aria-hidden="true" />
            <span>评论</span>
            <span v-if="commentCount !== undefined && commentCount > 0" class="article-action-count">{{ commentCount }}</span>
          </button>
        </div>
      </div>
```
4. Style `.article-action-strip`, `.article-action-strip__left`, `.article-action-strip__right`, `.article-action-btn`, `.article-play-button` with strict 4px radius, 0 shadow, 36px touch target.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: PASS with 19 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedArticleSheet.vue tests/unit/components/feed/FeedArticleSheet.spec.ts
git commit -m "feat(feed): implement headline and integrated action strip in article reader"
```

---

### Task 3: Cover Image Repositioning (`.article-cover`) under Action Strip with Fallback & Summary Styling

**Files:**
- Modify: `src/components/feed/FeedArticleSheet.vue`
- Modify: `tests/unit/components/feed/FeedArticleSheet.spec.ts`

**Interfaces:**
- Consumes: `showFeedCover`, `feedCoverUrl`, `feedCoverFailed`, `handleFeedCoverError`, `feedSourceTitle`, `article.post.summary`
- Produces: `.article-cover` positioned under `.article-action-strip` and directly above `.article-summary` or `.article-body-wrap`.

- [ ] **Step 1: Write the failing test**

Add order verification test to `tests/unit/components/feed/FeedArticleSheet.spec.ts`:

```typescript
	it("places cover image below the action strip and above article body", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "cover-order-1",
						feed_source_id: "src-1",
						title: "封面顺序测试文章",
						image_url: "https://cdn.example.com/cover.jpg",
						summary: "<p>文章正文内容</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});

		const rootHtml = wrapper.html();
		const headlineIndex = rootHtml.indexOf("article-headline");
		const actionStripIndex = rootHtml.indexOf("article-action-strip");
		const coverIndex = rootHtml.indexOf("article-cover");
		const bodyIndex = rootHtml.indexOf("article-body-wrap");

		expect(headlineIndex).toBeLessThan(actionStripIndex);
		expect(actionStripIndex).toBeLessThan(coverIndex);
		expect(coverIndex).toBeLessThan(bodyIndex);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: FAIL (in the existing template, `article-cover` is at line 84 before `article-meta` and headline).

- [ ] **Step 3: Write minimal implementation**

Move the `<div v-if="showFeedCover" class="article-cover" ...>` block in `src/components/feed/FeedArticleSheet.vue` from above `article-meta` to between `.article-action-strip` and `.article-body-wrap`.
Update `.article-cover` styling:
- Max-height 360px on desktop, 220px on mobile.
- `width: 100%`, `object-fit: cover`.
- `border: 1px solid var(--a-color-border-soft)`, `border-radius: 4px`.
- Fallback text container styled with subtle muted border and background.
Update `.article-summary` styling with 2px solid left accent bar and refined line-height.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: PASS with 20 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedArticleSheet.vue tests/unit/components/feed/FeedArticleSheet.spec.ts
git commit -m "feat(feed): reposition cover image below action strip with responsive fallback"
```

---

### Task 4: Complete Paper Theme (`#FFFFFF`), Zero Shadow, 4px Radius, and Responsive Layout

**Files:**
- Modify: `src/components/feed/FeedArticleSheet.vue`
- Modify: `src/assets/feed-reader.css`
- Modify: `tests/unit/components/feed/FeedArticleSheet.spec.ts`

**Interfaces:**
- Consumes: design tokens (`--a-color-bg`, `--a-color-border-soft`, `--a-color-text`, `--a-font-serif`)
- Produces: Polished responsive paper styles with zero shadow, strict 4px radius, clean hairline dividers.

- [ ] **Step 1: Write the failing test**

Add tests for responsive headline and zero-shadow constraints:

```typescript
	it("guarantees zero-shadow and 4px radius on action elements", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "style-test-1",
						feed_source_id: "src-1",
						title: "样式测试文章",
						link: "https://example.com/style",
						summary: "<p>正文</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: { PSheet: { template: "<section><slot /></section>" } },
			},
		});

		const buttons = wrapper.findAll(".article-action-btn, .article-source-link");
		expect(buttons.length).toBeGreaterThan(0);
	});
```

- [ ] **Step 2: Run test to verify it fails (or checks styles)**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`

- [ ] **Step 3: Write minimal implementation**

In `src/components/feed/FeedArticleSheet.vue` and `src/assets/feed-reader.css`:
1. Clean up unused legacy classes (`.article-toolbar`, `.article-meta--reader`, `.article-star-button`).
2. Add full styles for `.article-headline`:
   - `font-size: 2rem` (desktop), `1.65rem` (mobile max-width 767px)
   - `line-height: 1.28` (desktop), `1.32` (mobile)
   - `font-weight: 600`, `letter-spacing: -0.015em`, `text-wrap: balance`
   - `color: var(--a-color-text)`
   - `margin: 0.75rem 0 1rem 0`
3. Refine `.article-action-strip`:
   - `display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem 1rem;`
   - `padding-bottom: 0.75rem; border-bottom: 1px solid var(--a-color-border-soft); margin-bottom: 1.5rem;`
4. Refine `.article-action-btn`, `.article-source-badge`, `.article-play-button`:
   - `border-radius: 4px; box-shadow: none !important;`
   - `min-height: 36px; padding: 0.35rem 0.65rem;`
   - `border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg);`
   - Hover: `border-color: var(--a-color-text);`
5. Ensure mobile adjustments in `@media (max-width: 767px)`:
   - Action strip wraps smoothly without breaking layout.
   - Headline scales down to `1.65rem`.
   - Cover height scales to `220px`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/components/feed/FeedArticleSheet.spec.ts`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/FeedArticleSheet.vue src/assets/feed-reader.css tests/unit/components/feed/FeedArticleSheet.spec.ts
git commit -m "feat(feed): apply paper theme styling, zero shadow, and 4px radius"
```

---

### Task 5: Full Verification and Regression Test Suite

**Files:**
- Run workspace validation: type check, all unit tests, production build.

- [ ] **Step 1: Run type checking**

Run: `bun run type-check`
Expected: 0 TypeScript errors.

- [ ] **Step 2: Run all unit tests**

Run: `bun run test:unit`
Expected: All unit test suites pass (82+ tests).

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit any adjustments if needed**

```bash
git commit --allow-empty -m "chore(feed): complete full verification suite"
```
