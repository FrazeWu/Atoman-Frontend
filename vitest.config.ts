import path from "node:path";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const nodeOnlyTests = [
	"tests/unit/api/{client,dm,feedMembership,musicV1,musicV1.album-import-v2,musicV1.lyrics,musicV1.starred.integration,podcast-comments,references,transport,upload,useApi-contract,userProfile}.spec.ts",
	"tests/unit/app/App.shell-loading.spec.ts",
	"tests/unit/components/{AppTopbar.auth-loading,PEditor.public-loading,PEditor.runtime-loading}.spec.ts",
	"tests/unit/composables/{useCommentDraft,useComments,useContentLifecycle,useGlobalSearch,useInteractions,useMarkdownRenderer.styles,useMediaCreationSteps,useMusicFavoritePlaylist,useMusicLyrics,useMusicRouteSelection,usePendingMusicLyricsAnnotations,useRequestGeneration,useVideoBookmarks,useVideoDeepLink}.spec.ts",
	"tests/unit/config/*.spec.ts",
	"tests/unit/e2e/base-fixture.spec.ts",
	"tests/unit/functions/*.spec.ts",
	"tests/unit/references/*.spec.ts",
	"tests/unit/router/{musicRoutes,router.layout-loading,routes,shortNoteRoutes,siteContext,studioRoutes}.spec.ts",
	"tests/unit/services/*.spec.ts",
	"tests/unit/stores/{adminFeedFulltext,dm,forum.topic-race,notification,playerPodcastAdapter}.spec.ts",
	"tests/unit/system/{AppSidebar.blog-short-note,AppTopbar.kanbo,AppTopbar.roomNames,ContentLayouts.sidebar,MusicAlbumsRoomName,SidebarRoomNames,blog-layering,feed-item-actions-layering,feed-layering,feed-presentation-layering,layering-contract,layering-imports,media-editor-upload-layering,music-api-layering,post-editor-layering,timeline-home-layering}.spec.ts",
	"tests/unit/ui/{borderless-white-ui,design-system-contract,module-style-contract,music-shell-ui-compliance,overlay-layer-contract,podcast-video-creator-ui,ui-guidelines}.spec.ts",
	"tests/unit/utils/{audioWaveform,blogCollectionSelection,debateReferences,feedSourcePresentation,feedSubscriptions,feedTimelineQuery,logger,mediaUrl,musicImportDisplay,musicLyrics,musicLyricsDraft,musicLyricsVersionDiff,musicMedia,musicRecommendations,musicRedirect,resourceReferences}.spec.ts",
	"tests/unit/views/blog/{BlogLayout,PostEditorView.layout,ShortNoteTimelineView}.spec.ts",
	"tests/unit/views/music/{MusicArtistsView.layout,MusicDiscoverView.layout,music-loading}.spec.ts",
	"tests/unit/views/timeline/{TimelineHomeView.map-loading,TimelineRoutePrefixes}.spec.ts",
	"tests/unit/views/video/VideoLayout.spec.ts",
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
					name: "jsdom",
					environment: "jsdom",
					globals: true,
					setupFiles: ["./tests/unit/setup.ts"],
					include: ["tests/unit/**/*.spec.ts", "src/**/*.spec.ts"],
					exclude: nodeOnlyTests,
					clearMocks: true,
					restoreMocks: true,
					mockReset: true,
				},
			},
		],
	},
});
