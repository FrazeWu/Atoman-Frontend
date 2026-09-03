import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
	readFileSync(resolve(process.cwd(), path), "utf8");
const styleSource = read("src/style.css");
const sheetSource = read("src/components/ui/PSheet.vue");
const playerSource = read("src/components/music/AudioPlayer.vue");
const playerQueueSource = read("src/components/music/AudioPlayerQueue.vue");
const lyricsSource = read("src/components/music/MusicLyricsPanel.vue");
const lyricEditorSource = read(
	"src/components/music/MusicLyricEditorDrawer.vue",
);
const topbarSource = read("src/components/system/AppTopbar.vue");
const topbarAuthSource = read(
	"src/components/system/AppTopbarAuthControls.vue",
);
const globalSearchSource = read(
	"src/components/system/AppTopbarGlobalSearch.vue",
);
const mobileNavSource = read("src/components/system/MobileBottomNav.vue");
const feedSource = read("src/views/feed/FeedView.vue");
const inboxSource = read("src/views/feed/InboxPage.vue");
const videoEditorSource = read("src/views/video/VideoEditorView.vue");
const podcastEditorSource = read("src/views/podcast/PodcastEditorView.vue");
const postEditorSource = read("src/views/blog/PostEditorView.vue");
const versionHistorySource = read(
	"src/components/blog/PostVersionHistoryModal.vue",
);
const commentSideSheetSource = read(
	"src/components/comment/CommentSideSheet.vue",
);
const commentSectionSource = read("src/components/comment/CommentSection.vue");
const commentReportSource = read(
	"src/components/comment/CommentReportDialog.vue",
);
const dmReportSource = read("src/components/dm/DMReportModal.vue");
const countryFieldSource = read("src/components/ui/PCountryRegionField.vue");
const adminUserDetailSource = read(
	"src/components/admin/AdminUserDetailSheet.vue",
);
const subscriptionManageSource = read(
	"src/components/feed/SubscriptionManageSheet.vue",
);
const subscriptionRulesSource = read(
	"src/components/feed/SubscriptionRulesPanel.vue",
);
const musicCreationSource = read(
	"src/components/music/MusicCreationFlowDrawer.vue",
);
const songLyricsEditorSource = read(
	"src/components/music/MusicSongLyricsEditorDrawer.vue",
);

describe("overlay layer contract", () => {
	it("defines one ordered semantic layer scale", () => {
		expect(styleSource).toContain("--a-z-navigation: 100;");
		expect(styleSource).toContain("--a-z-sheet-backdrop: 300;");
		expect(styleSource).toContain("--a-z-sheet: 310;");
		expect(styleSource).toContain("--a-z-modal-backdrop: 500;");
		expect(styleSource).toContain("--a-z-modal: 510;");
		expect(styleSource).toContain("--a-z-global-overlay: 480;");
		expect(styleSource).toContain("--a-z-player-lyrics: 700;");
		expect(styleSource).toContain("--a-z-player-queue: 710;");
		expect(styleSource).toContain("--a-z-player: 720;");
		expect(styleSource).toContain("--a-z-player-sheet-backdrop: 730;");
		expect(styleSource).toContain("--a-z-player-sheet: 740;");
		expect(styleSource).toContain("--a-z-player-modal-backdrop: 750;");
		expect(styleSource).toContain("--a-z-player-modal: 760;");
		expect(styleSource).toContain("--a-z-lightbox: 800;");
		expect(styleSource).toContain("--a-z-toast: 900;");
		expect(styleSource).toContain("--a-z-global-menu: 950;");

		expect(sheetSource).toContain("z-index: var(--a-z-sheet);");
		expect(playerSource).toContain("z-index: var(--a-z-player-lyrics);");
		expect(playerQueueSource).toContain("z-index: var(--a-z-player-queue);");
		expect(lyricsSource).toContain("z-index: var(--a-z-player-lyrics);");
		expect(topbarSource).toContain("z-index: var(--a-z-navigation);");
		expect(topbarSource).toContain("z-index: var(--a-z-global-menu);");
		expect(topbarAuthSource).toContain("z-index: var(--a-z-global-menu);");
		expect(globalSearchSource).toContain("z-index: var(--a-z-global-menu);");
		expect(mobileNavSource).toContain("z-index: var(--a-z-navigation);");
		expect(inboxSource).toMatch(/<PSheet[\s\S]*above-player/);
		expect(videoEditorSource).toMatch(/<PConfirm[\s\S]*above-player/);
		expect(podcastEditorSource).toMatch(/<PConfirm[\s\S]*above-player/);
		expect(postEditorSource).toMatch(
			/<PostVersionHistoryModal[\s\S]*above-player/,
		);
		expect(versionHistorySource).toMatch(/<PModal[\s\S]*above-player/);
		expect(commentSideSheetSource).toMatch(
			/<CommentSection[\s\S]*:above-player="abovePlayer"/,
		);
		expect(commentSectionSource).toMatch(
			/<CommentReportDialog[\s\S]*:above-player="abovePlayer"/,
		);
		expect(commentReportSource).toMatch(
			/<PModal[\s\S]*:above-player="abovePlayer"/,
		);
		expect(inboxSource).toMatch(/<DMReportModal[\s\S]*above-player/);
		expect(dmReportSource).toMatch(
			/<PModal[\s\S]*:above-player="abovePlayer"/,
		);
		expect(inboxSource).not.toContain("z-index: 30;");
		expect(feedSource).toContain("z-index: var(--a-z-navigation);");
		expect(feedSource).not.toContain("z-index: 1100;");
		expect(countryFieldSource).toContain("import PModal from './PModal.vue'");
		expect(countryFieldSource).toMatch(/<PModal[\s\S]*above-player/);
		expect(countryFieldSource).not.toContain("country-field-dialog-backdrop");
		expect(lyricEditorSource).toContain("above-player");
		expect(lyricsSource).toMatch(/<PConfirm[\s\S]*above-player/);
		expect(adminUserDetailSource).toMatch(
			/<PConfirm[\s\S]*pendingRevoke[\s\S]*above-player/,
		);
		expect(subscriptionManageSource).toMatch(
			/<PConfirm[\s\S]*deletePending[\s\S]*above-player/,
		);
		expect(subscriptionRulesSource).toContain(
			':above-player="props.abovePlayer"',
		);
		expect(musicCreationSource).toMatch(/<PConfirm[\s\S]*above-player/);
		expect(songLyricsEditorSource).toMatch(/<PConfirm[\s\S]*above-player/);
		expect(sheetSource).toMatch(
			/\.p-sheet-root--above-player \.p-sheet-backdrop\s*\{[^}]*z-index: var\(--a-z-player-sheet-backdrop\);/,
		);
		expect(sheetSource).toMatch(
			/\.p-sheet-root--above-player \.p-sheet-layer\s*\{[^}]*z-index: var\(--a-z-player-sheet\);/,
		);
		expect(styleSource).toMatch(
			/\.p-modal-backdrop--above-player\s*\{[^}]*z-index: var\(--a-z-player-modal-backdrop\);/,
		);
		expect(styleSource).toMatch(
			/\.p-modal-backdrop--above-player \.p-modal\s*\{[^}]*z-index: var\(--a-z-player-modal\);/,
		);
	});

	it("reserves content and sheet height only for visible fixed chrome", () => {
		expect(styleSource).toContain("--a-topbar-height: 56px;");
		expect(styleSource).toContain("--a-player-height: 68px;");
		expect(styleSource).toContain("--a-player-reserved-height: 0px;");
		expect(styleSource).toContain(
			'html[data-player-active="true"][data-player-pinned="true"]',
		);
		expect(styleSource).toContain(
			"--a-player-reserved-height: var(--a-player-height);",
		);
		expect(styleSource).toContain(
			'html[data-player-active="true"][data-player-pinned]',
		);
		expect(styleSource).toMatch(
			/height:\s*calc\(\s*100dvh\s*-\s*var\(--a-topbar-height\)/,
		);
		expect(sheetSource).toContain("bottom: var(--a-content-bottom-offset);");
		expect(styleSource).toContain("body:has(.app-shell.has-sidebar)");
		expect(styleSource).toContain("body:has(.studio-layout)");
		expect(styleSource).toMatch(
			/body:has\(\.app-shell\.has-sidebar\) \{[^}]*--a-content-bottom-offset:/s,
		);
		expect(styleSource).toMatch(
			/--a-mobile-nav-reserved-height:\s*calc\(\s*64px\s*\+\s*env\(safe-area-inset-bottom, 0px\)/,
		);
		expect(playerSource).toContain("height: var(--a-mobile-player-height);");
	});

	it("keeps one visible page rail for every lower sheet layer", () => {
		expect(sheetSource).toContain(
			"const layerInset = computed(() => effectiveLayerIndex.value * 32)",
		);
		expect(sheetSource).toContain("width: 32px;");
		expect(sheetSource).not.toContain("opacity: 0.6;\n  pointer-events: none;");
	});
});
