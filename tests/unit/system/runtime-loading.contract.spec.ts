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

	it("keeps portal route guards independent from the deferred roles chunk", () => {
		const source = readSource("src/router/guards.ts");

		expect(source).not.toContain('from "@/utils/roles"');
		expect(source).toContain("role === \"admin\"");
		expect(source).toContain("role === \"moderator\"");
		expect(source).toContain("role === \"owner\"");
	});

	it("lets the portal prerender paint before either runtime mounts", () => {
		for (const source of [readSource("src/main.ts"), readSource("apps/mobile/main.ts")]) {
			expect(source).toContain("waitForInitialPaint");
		}
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

	it("keeps the mobile portal prerender large enough to remain the LCP candidate", () => {
		const source = readSource("index.html");

		expect(source).toMatch(
			/@media \(max-width: 600px\) \{\s+\.portal-prerender h1 \{\s+font-size: 36px;/,
		);
		expect(source).toMatch(
			/\.portal-prerender h1 \{[\s\S]*?line-height: 1\.2;/,
		);
	});

	it("defers non-critical shell work and portal content until after the initial paint", () => {
		expect(readSource("src/App.vue")).toContain("scheduleIdleTask");
		const portalSource = readSource("src/views/portal/PortalView.vue");
		expect(portalSource).toContain("scheduleIdleTask(loadHotContent, 5000, 2000)");
		expect(portalSource).not.toContain("onMounted(loadHotContent)");
		const topbarSource = readSource("src/components/system/AppTopbar.vue");
		expect(topbarSource).toContain('v-if="!isAuthRoute" class="topbar-search-slot"');
		expect(topbarSource).toContain('v-if="searchReady"');
		expect(topbarSource).not.toContain("scheduleIdleTask(() => authStore.restoreSession()");
	});

	it("keeps the portal initial chunk on the API URL helper only", () => {
		const source = readSource("src/views/portal/PortalView.vue");

		expect(source).toContain("import { useApiUrl } from '@/composables/useApiUrl'");
		expect(source).not.toContain("from '@/composables/useApi'");
		expect(source).toContain("const apiUrl = useApiUrl()");
		expect(source).not.toContain("const api = useApi()");
		expect(source).toContain("`${apiUrl}/portal/hot?limit=6&spotlight_offset=0`");
	});

	it("keeps site access loading on the API URL helper only", () => {
		const source = readSource("src/stores/siteAccess.ts");

		expect(source).toContain("import { useApiUrl } from '@/composables/useApiUrl'");
		expect(source).not.toContain("from '@/composables/useApi'");
		expect(source).toContain("`${apiUrl}/site/access`");
		expect(source).toContain("`${apiUrl}/settings/site-access`");
		expect(source).not.toContain("useApi()");
	});

	it("keeps URL-only bootstrap modules independent from the endpoint registry", () => {
		for (const relativePath of [
			"src/App.vue",
			"apps/mobile/MobileApp.vue",
			"src/stores/auth.ts",
			"src/stores/siteAccess.ts",
			"src/views/portal/PortalView.vue",
		]) {
			const source = readSource(relativePath);
			expect(source).toContain("@/composables/useApiUrl");
			expect(source).not.toContain("@/composables/useApi'");
		}

		const transportSource = readSource("src/api/transport.ts");
		expect(transportSource).toContain("@/composables/useApiUrl");
		expect(transportSource).not.toContain("@/composables/useApi'");
	});

	it("keeps editor and feed reader styles out of the initial entries", () => {
		for (const source of [readSource("src/main.ts"), readSource("apps/mobile/main.ts")]) {
			expect(source).not.toContain('assets/editor.css');
			expect(source).not.toContain('assets/feed-reader.css');
		}
		expect(readSource("src/components/shared/PEditorRuntime.vue")).toContain(
			"@/assets/editor.css",
		);
		expect(readSource("src/components/blog/BlogPostReader.vue")).toContain(
			"@/assets/editor.css",
		);
		expect(readSource("src/components/feed/FeedArticleSheet.vue")).toContain(
			"@/assets/editor.css",
		);
		expect(readSource("src/components/feed/FeedArticleSheet.vue")).toContain(
			"@/assets/feed-reader.css",
		);
		expect(readSource("src/components/feed/FeedReaderContent.vue")).toContain(
			"@/assets/feed-reader.css",
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

	it("does not load the mobile-only switcher in the desktop shell", () => {
		const source = readSource("src/components/system/AppTopbar.vue");

		expect(source).not.toContain(
			"import MobileModuleSwitcher from '@/components/system/MobileModuleSwitcher.vue'",
		);
		expect(source).toContain(
			"defineAsyncComponent(() => import('@/components/system/MobileModuleSwitcher.vue'))",
		);
		expect(source).toContain('v-if="showMobileModuleSwitcher && !isAuthRoute"');
		expect(source).toContain("matchMedia?.('(max-width: 720px)')");
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
		expect(source).not.toContain("authStore.restoreSession");
	});

	it("defers the secondary mobile route manifest until navigation needs it", () => {
		const routerSource = readSource("apps/mobile/router.ts");
		const initialRoutesSource = readSource("apps/mobile/mobileInitialRoutes.ts");
		const mobileTopbarSource = readSource("apps/mobile/MobileTopbar.vue");

		expect(routerSource).toContain("mobileInitialRoutes");
		expect(routerSource).not.toContain("import { mobileRoutes } from './mobileRoutes'");
		expect(routerSource).toContain("import('./mobileRoutes')");
		expect(mobileTopbarSource).toContain("from './mobileInitialRoutes'");
		expect(mobileTopbarSource).not.toContain("from './mobileRoutes'");
		expect(initialRoutesSource).toContain("PortalView");
		expect(initialRoutesSource).not.toContain("FeedLayout");
	});

	it("loads portal content cards synchronously to prevent layout shifts", () => {
		const source = readSource("src/views/portal/PortalView.vue");

		for (const importPath of [
			"@/components/shared/BlogItemCard.vue",
			"@/components/music/MusicAlbumCard.vue",
			"@/components/shared/PVideoCard.vue",
			"@/components/ui/PContentCard.vue",
		]) {
			expect(source).toContain(`from '${importPath}'`);
			expect(source).not.toContain(`import('${importPath}')`);
		}
	});

	it("defers offscreen portal card mounting until sections approach the viewport", () => {
		const source = readSource("src/views/portal/PortalView.vue");

		expect(source).toContain("IntersectionObserver");
		expect(source).toContain('v-if="isSectionReady(section.module)"');
		expect(source).toContain("portal-hot__section-placeholder");
	});

	it("reserves stable space for every deferred portal section", () => {
		const source = readSource("src/views/portal/PortalView.vue");

		for (const module of ["blog", "feed", "music", "video", "debate"]) {
			expect(source).toContain(`.portal-hot__section-placeholder--${module}`);
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
