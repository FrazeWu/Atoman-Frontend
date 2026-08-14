import path from "node:path";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export const nodeOnlyTests = [
	"tests/unit/api/{client,dm,feedMembership,musicV1,musicV1.album-import-v2,musicV1.lyrics,musicV1.starred.integration,podcast-comments,references,transport,upload,useApi-contract,userProfile}.spec.ts",
	"tests/unit/components/AppTopbar.auth-loading.spec.ts",
	"tests/unit/composables/{useCommentDraft,useComments,useContentLifecycle,useGlobalSearch,useInteractions,useMarkdownRenderer.styles,useMediaCreationSteps,useMusicFavoritePlaylist,useMusicLyrics,useMusicRouteSelection,usePendingMusicLyricsAnnotations,useRequestGeneration,useVideoBookmarks,useVideoDeepLink}.spec.ts",
	"tests/unit/config/*.spec.ts",
	"tests/unit/e2e/*.spec.ts",
	"tests/unit/functions/*.spec.ts",
	"tests/unit/references/*.spec.ts",
	"tests/unit/router/{musicRoutes,routes,shortNoteRoutes,siteContext,studioRoutes}.spec.ts",
	"tests/unit/services/*.spec.ts",
	"tests/unit/stores/{adminFeedFulltext,dm,forum.topic-race,notification,playerPodcastAdapter}.spec.ts",
	"tests/unit/system/{ContentLayouts.sidebar,blog-layering,feed-item-actions-layering,feed-layering,feed-presentation-layering,layering-imports,media-editor-upload-layering,music-api-layering,navigation.contract,post-editor-layering,runtime-loading.contract,timeline-home-layering}.spec.ts",
	"tests/unit/ui/{design-system-contract,module-style-contract,music-shell-ui-compliance,overlay-layer-contract,ui-guidelines}.spec.ts",
	"tests/unit/utils/{audioWaveform,blogCollectionSelection,debateReferences,feedSourcePresentation,feedSubscriptions,feedTimelineQuery,logger,mediaUrl,musicImportDisplay,musicLyrics,musicLyricsDraft,musicLyricsVersionDiff,musicMedia,musicRecommendations,musicRedirect,resourceReferences}.spec.ts",
	"tests/unit/views/blog/{PostEditorView.layout,ShortNoteTimelineView}.spec.ts",
];

const jsdomOnlyTests = [
	"tests/unit/components/feed/{FeedArticleSheet,FeedSourceIdentityCard}.spec.ts",
	"tests/unit/components/music/MusicCreationAlbumImportStep.spec.ts",
	"tests/unit/composables/useMarkdownRenderer.sanitize.spec.ts",
	"tests/unit/system/PSheet.spec.ts",
	"tests/unit/views/feed/FeedView.spec.ts",
	"tests/unit/views/video/VideoEditorView.spec.ts",
];

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		maxWorkers: 4,
		projects: [
			{
				plugins: [vue()],
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./src"),
					},
				},
				test: {
					name: "node-contracts",
					environment: "node",
					globals: true,
					setupFiles: ["./tests/unit/setup-node.ts"],
					include: nodeOnlyTests,
				},
			},
			{
				plugins: [vue()],
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./src"),
					},
				},
				test: {
					name: "happy-dom",
					environment: "happy-dom",
					globals: true,
					setupFiles: ["./tests/unit/setup.ts"],
					include: ["tests/unit/**/*.spec.ts", "src/**/*.spec.ts"],
					exclude: [...nodeOnlyTests, ...jsdomOnlyTests],
					clearMocks: true,
					restoreMocks: true,
					mockReset: true,
				},
			},
			{
				plugins: [vue()],
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./src"),
					},
				},
				test: {
					name: "jsdom",
					environment: "jsdom",
					globals: true,
					setupFiles: ["./tests/unit/setup.ts"],
					include: jsdomOnlyTests,
					clearMocks: true,
					restoreMocks: true,
					mockReset: true,
				},
			},
		],
	},
});
