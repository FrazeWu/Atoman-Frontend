import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const videoFiles = [
	"src/views/video/VideoEditorView.vue",
	"src/views/video/VideoDetailView.vue",
	"src/views/video/VideoHomeView.vue",
	"src/views/video/VideoSubscriptionsView.vue",
	"src/views/video/VideoFavoritesView.vue",
	"src/components/shared/PVideoPlayerShell.vue",
];
const musicFiles = [
	"src/views/music/ArtistsView.vue",
	"src/views/music/DiscoverView.vue",
	"src/views/music/LibraryView.vue",
	"src/components/music/ArtistDrawer.vue",
	"src/components/music/AlbumDrawer.vue",
	"src/components/music/PlaylistDrawer.vue",
	"src/components/music/NestedActionDrawer.vue",
];
const shellFiles = [
	"src/style.css",
	"src/components/system/AppSidebar.vue",
	"src/components/system/AppTopbar.vue",
	"src/components/system/AppTopbarAuthControls.vue",
	"src/components/system/MobileBottomNav.vue",
	"src/components/system/MobileMoreSheet.vue",
	"src/components/system/TopbarSearchSection.vue",
	"src/components/shared/InteractionBar.vue",
	"src/components/shared/PEditorRuntime.vue",
	"src/components/setting/SettingFeedSourcePanel.vue",
	"src/views/setting/SettingAccessView.vue",
	"src/components/setting/SettingMusicReviewPanel.vue",
	"src/components/setting/SettingRolesPanel.vue",
];
const blogFeedFiles = [
	"src/components/blog/PostCoverField.vue",
	"src/components/blog/PostEditorSidebar.vue",
	"src/components/blog/PostEditorTopbar.vue",
	"src/components/feed/FeedArticleSheet.vue",
	"src/components/feed/FeedSidebarSources.vue",
	"src/components/feed/FeedSourceArticlesSheet.vue",
	"src/components/feed/FeedSourceIdentityCard.vue",
	"src/components/feed/FeedTimelineFooter.vue",
	"src/components/feed/SubscriptionAddSheet.vue",
	"src/components/feed/SubscriptionManageSheet.vue",
	"src/views/blog/BlogHomeView.vue",
	"src/views/blog/BlogSubscriptionsView.vue",
	"src/views/blog/BookmarkView.vue",
	"src/views/blog/ChannelView.vue",
	"src/views/blog/CollectionView.vue",
	"src/views/blog/PostDetailView.vue",
	"src/views/blog/PostEditorView.vue",
	"src/views/blog/ProfileView.vue",
	"src/views/feed/FeedItemDetailView.vue",
	"src/views/feed/FeedReadingListView.vue",
	"src/views/feed/FeedRecommendedView.vue",
	"src/views/feed/FeedStarredView.vue",
	"src/views/feed/FeedStatsView.vue",
	"src/views/feed/FeedView.vue",
	"src/views/feed/InboxPage.vue",
];
const remainingModuleFiles = [
	"src/views/debate/DebateHomeView.vue",
	"src/views/forum/ForumHomeView.vue",
	"src/views/forum/ForumSearchView.vue",
	"src/views/forum/ForumTopicView.vue",
	"src/views/podcast/PodcastEditorView.vue",
	"src/views/podcast/PodcastEpisodeView.vue",
	"src/views/podcast/PodcastFavoritesView.vue",
	"src/views/podcast/PodcastHomeView.vue",
	"src/views/podcast/PodcastShowView.vue",
	"src/views/podcast/PodcastSubscriptionsView.vue",
	"src/views/timeline/PersonListView.vue",
	"src/views/timeline/PersonMapView.vue",
	"src/views/timeline/TimelineHomeView.vue",
	"src/views/timeline/TimelineMapPane.vue",
	"src/views/portal/PortalView.vue",
	"src/views/system/AboutView.vue",
	"src/views/system/NotFoundView.vue",
];

describe("module style contract", () => {
	it("uses one accessible control scale across both button systems", () => {
		const globalStyles = read("src/style.css");
		const button = read("src/components/ui/PButton.vue");

		for (const token of [
			"--a-control-height-sm: 2.25rem",
			"--a-control-height-md: 2.5rem",
			"--a-control-height-lg: 2.75rem",
		]) {
			expect(globalStyles).toContain(token);
		}
		expect(globalStyles).toMatch(/\.a-btn:focus-visible\s*\{/);
		expect(globalStyles).toMatch(/\.a-btn--sm\s*\{[^}]*min-height:\s*var\(--a-control-height-sm\)/s);
		expect(globalStyles).toMatch(/\.a-btn--md\s*\{[^}]*min-height:\s*var\(--a-control-height-md\)/s);
		expect(button).toMatch(/\.p-button--sm\s*\{[^}]*min-height:\s*var\(--a-control-height-sm\)/s);
		expect(button).toMatch(/\.p-button--md\s*\{[^}]*min-height:\s*var\(--a-control-height-md\)/s);
	});

	it("keeps mobile shell controls touchable and content states announced", () => {
		const topbar = read("src/components/system/AppTopbar.vue");
		const globalSearch = read("src/components/system/AppTopbarGlobalSearch.vue");
		const feed = read("src/views/feed/FeedView.vue");

		expect(topbar).toContain("'brand-link--mobile-visible': !hasSidebar && !isAuthRoute");
		expect(topbar).toMatch(/\.topbar-collapse-btn\s*\{[^}]*width:\s*var\(--a-control-height-md\)[^}]*height:\s*var\(--a-control-height-md\)/s);
		expect(topbar).toMatch(/\.theme-toggle-btn\s*\{[^}]*width:\s*var\(--a-control-height-md\)[^}]*height:\s*var\(--a-control-height-md\)/s);
		expect(globalSearch).toMatch(/\.search-pill\s*\{[^}]*height:\s*var\(--a-control-height-md\)/s);
		expect(feed).toMatch(/v-if="loadingTimeline"[^>]*class="feed-loading"[^>]*role="status"/);
	});

	it("places progress feedback before skeletons instead of covering them", () => {
		const progress = read("src/components/ui/PContentProgress.vue");

		expect(progress).toMatch(/\.p-content-progress__overlay\s*\{[^}]*display:\s*grid/s);
		expect(progress).toMatch(/\.p-content-progress__skeleton-wrapper\s*\{[^}]*position:\s*relative/s);
		expect(progress).toMatch(/\.p-content-progress__loader\s*\{[^}]*order:\s*-1/s);
	});

	it("keeps the portal focused on content instead of decorative gradients", () => {
		const portal = read("src/views/portal/PortalView.vue");

		expect(portal).not.toContain("portal-hot__hero-glow");
		expect(portal).not.toMatch(/(?:linear|radial)-gradient\(/);
	});

	it("keeps the debate graph link focus ring inside its clipped node", () => {
		const source = read("src/components/debate/DebateGraphNode.vue");
		const nodeRule = source.match(/\.debate-node\s*\{([^}]*)\}/)?.[1] ?? "";
		const focusRule =
			source.match(/\.debate-node__link:focus-visible\s*\{([^}]*)\}/)?.[1] ??
			"";

		expect(nodeRule).toMatch(/overflow:\s*hidden/);
		expect(focusRule).toMatch(/outline-offset:\s*-\d+px/);
	});

	it("keeps video surfaces flat, 4px, and headings at 500", () => {
		for (const path of videoFiles) {
			const source = read(path);
			expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/);
			expect(source, path).not.toMatch(/border-radius:\s*(8px|10px|12px|16px)/);
			expect(source, path).not.toMatch(
				/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/,
			);
		}
	});

	it("keeps music surfaces flat, 4px, and free of hand-drawn icons", () => {
		for (const path of musicFiles) {
			const source = read(path);
			expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/);
			expect(source, path).not.toMatch(
				/border-radius:\s*(8px|10px|12px|16px|999px)/,
			);
			expect(source, path).not.toMatch(
				/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/,
			);
			expect(source, path).not.toContain("<svg");
		}
	});

	it("keeps shell and settings title surfaces on the global contract", () => {
		for (const path of shellFiles) {
			const source = read(path);
			expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/);
			expect(source, path).not.toMatch(
				/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/,
			);
			expect(source, path).not.toMatch(
				/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/,
			);
		}
	});

	it("keeps Blog and Feed surfaces on the global contract", () => {
		for (const path of blogFeedFiles) {
			const source = read(path);
			expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/);
			expect(source, path).not.toMatch(
				/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/,
			);
			expect(source, path).not.toMatch(
				/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/,
			);
		}
	});

	it("hides the KaTeX display scrollbar without disabling overflow", () => {
		const source = read("src/views/blog/PostDetailView.vue");
		const displayRule = source.match(
			/\.prose-blog :deep\(\.katex-display\)\s*\{([^}]*)\}/,
		)?.[1] ?? "";

		expect(displayRule).toMatch(/overflow-x:\s*auto/);
		expect(displayRule).toMatch(/scrollbar-width:\s*none/);
		expect(displayRule).toMatch(/-ms-overflow-style:\s*none/);
		expect(source).toMatch(
			/\.prose-blog :deep\(\.katex-display::-webkit-scrollbar\)\s*\{\s*display:\s*none/,
		);
	});

	it("keeps remaining module surfaces on the global contract", () => {
		for (const path of remainingModuleFiles) {
			const source = read(path);
			expect(source, path).not.toMatch(/font-weight:\s*(700|800|900|950)/);
			expect(source, path).not.toMatch(
				/border-radius:\s*(8px|10px|12px|16px|20px|24px|999px)/,
			);
			expect(source, path).not.toMatch(
				/box-shadow:\s*(?:[1-9]|0\s+[1-9]|0\s+0\s+[1-9])/,
			);
		}
	});
});
