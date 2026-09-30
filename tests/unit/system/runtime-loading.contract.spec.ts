import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
	readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("runtime loading boundaries", () => {
	it("keeps mobile and desktop bootstrap preloads in separate branches", () => {
		const source = readSource("src/main.ts");

		expect(source).toMatch(
			/if \(mobileRuntime\) \{\s+const \[appModule, routerModule\] = await Promise\.all\(\[\s+import\("\.\.\/apps\/mobile\/MobileApp\.vue"\),\s+import\("\.\.\/apps\/mobile\/router"\),/,
		);
		expect(source).toMatch(
			/\} else \{\s+const \[appModule, routerModule\] = await Promise\.all\(\[\s+import\("\.\/App\.vue"\),\s+import\("\.\/router"\),/,
		);
		expect(source).not.toContain("mobileRuntime\n\t\t\t? import(");
	});

	it("loads the audio player only when a track is active", () => {
		const source = readSource("src/App.vue");

		expect(source).not.toContain(
			"import AudioPlayer from '@/components/music/AudioPlayer.vue'",
		);
		expect(source).toContain(
			"defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))",
		);
		expect(source).toContain('v-if="hasActiveTrack"');
	});

	it("keeps below-the-fold shell layers behind async boundaries", () => {
		const source = readSource("src/App.vue");

		for (const importPath of [
			"@/components/system/MobileBottomNav.vue",
			"@/components/system/SiteFooter.vue",
		]) {
			expect(source).not.toContain(`import ${importPath}`);
			expect(source).toContain(`import('${importPath}')`);
		}
		expect(source).toContain('v-if="sheetStore.stack.length > 0"');
		expect(source).not.toContain("NotificationToastStack");
		expect(readSource("src/components/system/AppTopbarAuthControls.vue")).toContain(
			"NotificationToastStack",
		);
	});

	it("defers non-critical shell work until the browser is idle", () => {
		expect(readSource("src/App.vue")).toContain("scheduleIdleTask");
		expect(readSource("src/views/portal/PortalView.vue")).toContain(
			"scheduleIdleTask(loadHotContent)",
		);
		expect(readSource("src/components/system/AppTopbar.vue")).toContain(
			"searchReady && !isAuthRoute",
		);
		expect(readSource("src/components/system/AppTopbar.vue")).toContain(
			"scheduleIdleTask(() => authStore.restoreSession())",
		);
	});

	it("keeps the studio route manifest out of the initial desktop router", () => {
		const routerSource = readSource("src/router.ts");
		const initialRoutesSource = readSource("src/router/buildInitialRoutes.ts");
		const mobileRoutesSource = readSource("apps/mobile/mobileRoutes.ts");

		expect(routerSource).toContain("buildInitialRoutes");
		expect(routerSource).not.toContain("buildAppRoutes");
		expect(initialRoutesSource).not.toContain("routes/studio");
		expect(mobileRoutesSource).not.toContain("routes/studio");
		expect(mobileRoutesSource).not.toContain("...studioRoutes");
	});

	it("defers the global search panel from the initial shell", () => {
		const source = readSource("src/components/system/AppTopbar.vue");

		expect(source).not.toContain(
			"import AppTopbarGlobalSearch from '@/components/system/AppTopbarGlobalSearch.vue'",
		);
		expect(source).toContain(
			"defineAsyncComponent(() => import('@/components/system/AppTopbarGlobalSearch.vue'))",
		);
	});

	it("keeps mobile chrome and player behind async boundaries", () => {
		const source = readSource("apps/mobile/MobileApp.vue");

		expect(source).not.toContain(
			"import MobileBottomNav from '@/components/system/MobileBottomNav.vue'",
		);
		expect(source).not.toContain(
			"import MobileAudioPlayer from './MobileAudioPlayer.vue'",
		);
		expect(source).toContain(
			"defineAsyncComponent(() => import('@/components/system/MobileBottomNav.vue'))",
		);
		expect(source).toContain(
			"defineAsyncComponent(() => import('./MobileAudioPlayer.vue'))",
		);
		expect(source).toContain(
			"scheduleIdleTask(() => authStore.restoreSession())",
		);
	});

	it("keeps portal content cards behind async boundaries", () => {
		const source = readSource("src/views/portal/PortalView.vue");

		for (const importPath of [
			"@/components/shared/BlogItemCard.vue",
			"@/components/music/MusicAlbumCard.vue",
			"@/components/shared/PVideoCard.vue",
			"@/components/ui/PContentCard.vue",
		]) {
			expect(source).not.toContain(`import ${importPath}`);
			expect(source).toContain(`import('${importPath}')`);
		}
	});

	it("loads top-level layouts through route-level dynamic imports", () => {
		const source = readSource("src/router/routes/modules.ts");
		const layouts = [
			"BlogLayout",
			"FeedLayout",
			"MusicLayout",
			"ForumLayout",
			"DebateLayout",
			"TimelineLayout",
			"PodcastLayout",
			"VideoLayout",
		];

		for (const layout of layouts) {
			expect(source).not.toContain(
				`import ${layout} from '@/views/${layout.replace("Layout", "").toLowerCase()}/${layout}.vue'`,
			);
		}
		const normalizedSource = source.replaceAll('"', "'");
		for (const [moduleName, layout] of [
			["blog", "BlogLayout"],
			["feed", "FeedLayout"],
			["music", "MusicLayout"],
			["forum", "ForumLayout"],
			["debate", "DebateLayout"],
			["timeline", "TimelineLayout"],
			["podcast", "PodcastLayout"],
			["video", "VideoLayout"],
		] as const) {
			expect(normalizedSource).toContain(
				`component: () => import('@/views/${moduleName}/${layout}.vue')`,
			);
		}
	});

	it("keeps the public discussion editor behind an async boundary", () => {
		for (const relativePath of [
			"src/views/forum/ForumTopicView.vue",
			"src/views/debate/DebateTopicView.vue",
		]) {
			const source = readSource(relativePath);

			expect(source, relativePath).not.toContain(
				"import PEditor from '@/components/shared/PEditor.vue'",
			);
			if (source.includes("@/components/shared/PEditor.vue")) {
				expect(source, relativePath).toContain(
					"defineAsyncComponent(() => import('@/components/shared/PEditor.vue'))",
				);
			}
		}
	});

	it("keeps the heavy editor runtime behind an async boundary", () => {
		const source = readSource("src/components/shared/PEditor.vue");
		for (const dependency of [
			"@codemirror/view",
			"@codemirror/state",
			"@codemirror/commands",
			"@codemirror/lang-markdown",
			"@codemirror/language-data",
			"@codemirror/language",
			"@lezer/highlight",
			"yjs",
			"y-websocket",
			"y-codemirror.next",
		]) {
			expect(source).not.toContain(`from '${dependency}'`);
		}
		expect(source).toContain("defineAsyncComponent");
		expect(source).toContain("import('./PEditorRuntime.vue')");
	});

	it("loads the timeline map only in map mode", () => {
		const source = readSource("src/views/timeline/TimelineHomeView.vue");

		expect(source).not.toMatch(/from 'ol\//);
		expect(source).toContain(
			"defineAsyncComponent(() => import('@/views/timeline/TimelineMapPane.vue'))",
		);
		expect(source).toContain("v-if=\"viewMode === 'map'\"");
	});

	it("delegates timeline comparison state and route synchronization", () => {
		const source = readSource("src/views/timeline/TimelineHomeView.vue");

		expect(source).toContain("useTimelineComparison({");
		for (const declaration of [
			"const compareIds = ref<string[]>([])",
			"const hydrateComparePool = async",
			"const addBatchToCompare =",
			"const parseCompareQuery =",
		]) {
			expect(source).not.toContain(declaration);
		}
	});

	it("keeps music discovery and audio creation lazy", () => {
		const albumsSource = readSource("src/views/music/AlbumsView.vue");
		const discoverSource = readSource("src/views/music/DiscoverView.vue");
		const playerSource = readSource("src/stores/player.ts");

		expect(albumsSource).not.toContain("player.fetchSongs()");
		expect(albumsSource).toMatch(
			/<DiscoverView\s+v-if="props\.loadContent"\s+page-title="专辑"\s+content-mode="albums"\s*\/>/,
		);
		expect(discoverSource).toContain("getMusicHome");
		expect(discoverSource).toContain("listMusicAlbums");
		expect(playerSource).not.toContain("const audio = new Audio()");
		expect(playerSource).toContain("const ensureAudio = () =>");
	});
});
