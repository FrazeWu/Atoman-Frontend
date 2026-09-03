import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import App from "../../../src/App.vue";

const styleSource = readFileSync(
	resolve(__dirname, "../../../src/style.css"),
	"utf8",
);
const appSource = readFileSync(
	resolve(__dirname, "../../../src/App.vue"),
	"utf8",
);
const playerSource = readFileSync(
	resolve(__dirname, "../../../src/components/music/AudioPlayer.vue"),
	"utf8",
);
const moduleLayoutSources = [
	"blog/BlogLayout.vue",
	"debate/DebateLayout.vue",
	"feed/FeedLayout.vue",
	"forum/ForumLayout.vue",
	"music/MusicLayout.vue",
	"podcast/PodcastLayout.vue",
	"timeline/TimelineLayout.vue",
	"video/VideoLayout.vue",
].map((path) =>
	readFileSync(resolve(__dirname, `../../../src/views/${path}`), "utf8"),
);
const getBlock = (selector: string) => {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = styleSource.match(
		new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, "m"),
	);
	return match?.[1] ?? "";
};

const getMediaBlock = (query: string) => {
	const marker = `@media ${query}`;
	const blocks: string[] = [];
	let searchFrom = 0;
	while (searchFrom < styleSource.length) {
		const start = styleSource.indexOf(marker, searchFrom);
		if (start === -1) break;
		const openBrace = styleSource.indexOf("{", start);
		if (openBrace === -1) break;

		let depth = 1;
		let index = openBrace + 1;
		while (index < styleSource.length && depth > 0) {
			const char = styleSource[index];
			if (char === "{") depth += 1;
			if (char === "}") depth -= 1;
			index += 1;
		}
		if (depth === 0) blocks.push(styleSource.slice(openBrace + 1, index - 1));
		searchFrom = index;
	}
	return blocks.join("\n");
};

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: "/",
				component: { template: "<div>sidebar route</div>" },
				meta: { hasSidebar: true },
			},
			{ path: "/plain", component: { template: "<div>plain route</div>" } },
			{
				path: "/login",
				component: { template: "<div>login route</div>" },
				meta: { authLayout: true },
			},
		],
	});

const mountAppAt = async (path: string) => {
	const pinia = createPinia();
	setActivePinia(pinia);

	const router = makeRouter();
	await router.push(path);
	await router.isReady();

	const wrapper = mount(App, {
		global: {
			plugins: [pinia, router],
			stubs: {
				RouterView: { template: '<div class="router-view-stub" />' },
				FirstLoginOnboarding: { template: '<div class="first-login-stub" />' },
				SiteFooter: { template: '<footer class="site-footer-stub" />' },
				AppTopbar: { template: '<header class="topbar-stub" />' },
			},
		},
	});

	await flushPromises();
	return { wrapper, router };
};

describe("App responsive shell", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/site/access")) {
				return new Response(JSON.stringify({ modules: {} }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});
	});

	it("mounts mobile bottom nav on sidebar module routes", async () => {
		const { wrapper } = await mountAppAt("/");

		expect(wrapper.findComponent({ name: "MobileBottomNav" }).exists()).toBe(
			true,
		);
	});

	it("does not mount mobile bottom nav on non-sidebar routes", async () => {
		const { wrapper } = await mountAppAt("/plain");

		expect(wrapper.findComponent({ name: "MobileBottomNav" }).exists()).toBe(
			false,
		);
	});

	it("does not mount mobile bottom nav on auth layout routes", async () => {
		const { wrapper } = await mountAppAt("/login");

		expect(wrapper.findComponent({ name: "MobileBottomNav" }).exists()).toBe(
			false,
		);
	});

	it("keeps the footer on sidebar module routes", async () => {
		const { wrapper } = await mountAppAt("/");

		expect(wrapper.find(".site-footer-stub").exists()).toBe(true);
	});

	it("keeps the footer on non-sidebar routes", async () => {
		const { wrapper } = await mountAppAt("/plain");

		expect(wrapper.find(".site-footer-stub").exists()).toBe(true);
	});

	it("omits the footer on auth layout routes", async () => {
		const { wrapper } = await mountAppAt("/login");

		expect(wrapper.find(".site-footer-stub").exists()).toBe(false);
	});

	it("mounts SiteFooter only once from the app shell", () => {
		expect(appSource).toContain('<SiteFooter v-if="!isAuthRoute" />');
		for (const source of moduleLayoutSources) {
			expect(source).not.toContain("<SiteFooter");
			expect(source).not.toContain(
				"import SiteFooter from '@/components/system/SiteFooter.vue'",
			);
		}
	});

	it("keeps the desktop module transition visible", () => {
		expect(appSource).toMatch(
			/\.module-slide-enter-active[\s\S]*?opacity 320ms ease,[\s\S]*?transform 520ms/,
		);
		expect(appSource).toContain("translateX(44px)");
		expect(appSource).toContain("translateX(-44px)");
	});
});

describe("shared responsive shell CSS", () => {
	const hasSidebarBlock = getBlock(".has-sidebar");
	const mainContentBlock = getBlock(".a-main-content");
	const desktopBlock = getMediaBlock("(min-width: 768px)");
	const tabletBlock = getMediaBlock("(max-width: 1023px)");
	const mobileBlock = getMediaBlock("(max-width: 767px)");

	it("keeps teleported overlays aligned when the desktop sidebar collapses", () => {
		expect(styleSource).toContain("--a-sidebar-collapsed-width: 4.5rem;");
		expect(desktopBlock).toContain(
			"body:has(.app-shell.has-sidebar .a-module-layout.is-sidebar-collapsed)",
		);
		expect(desktopBlock).toContain(
			"--a-sidebar-width: var(--a-sidebar-collapsed-width);",
		);
	});

	it("defines a tablet band that narrows sidebar occupancy before mobile", () => {
		expect(tabletBlock).toContain(".has-sidebar");
		expect(tabletBlock).toContain("--a-sidebar-width: 4.5rem;");
	});

	it("collapses sidebar occupancy and shows the mobile shell hook on small screens", () => {
		expect(mobileBlock).toContain(".p-sidebar,");
		expect(mobileBlock).toContain(".a-sidebar");
		expect(mobileBlock).toContain("display: none;");
		expect(mobileBlock).toContain(".mobile-bottom-nav");
		expect(mobileBlock).toContain("display: grid;");
	});

	it("defines shared desktop offsets for the responsive shell", () => {
		expect(styleSource).toMatch(
			/body:has\(\.app-shell\.has-sidebar\)\s*\{\s*--a-sidebar-width:\s*12rem;/,
		);
		expect(hasSidebarBlock).toContain("--a-mobile-nav-offset: 0px;");
		expect(mainContentBlock).toContain(
			"calc(8rem + var(--a-mobile-nav-offset, 0px))",
		);
	});

	it("keeps page scrolling on the document while the sidebar owns its scroll area", () => {
		expect(styleSource).toMatch(
			/\.p-sidebar\s*\{[\s\S]*?height:\s*calc\(\s*100dvh\s*-[\s\S]*?overflow-y:\s*auto;/,
		);
		expect(mainContentBlock).toContain(
			"padding: var(--a-page-start-space) 2rem",
		);
		expect(mainContentBlock).not.toContain("position: sticky;");
		expect(mainContentBlock).not.toContain("height: calc(100dvh");
		expect(mainContentBlock).not.toContain("overflow-y: auto;");
	});

	it("reserves safe-area space for the mobile bottom navigation", () => {
		expect(mobileBlock).toContain("--a-sidebar-width: 0px;");
		expect(mobileBlock).toContain("--a-mobile-nav-offset: 5.5rem;");
		expect(mobileBlock).toContain("calc(7rem + env(safe-area-inset-bottom))");
	});

	it("keeps the document-flow footer out of shared bottom offsets", () => {
		expect(styleSource).toContain("--a-footer-reserved-height: 0px;");
		expect(styleSource).not.toContain("body:has(.site-footer)");
		expect(styleSource).not.toContain("--a-footer-reserved-height: 88px;");
		expect(appSource).not.toContain(
			"padding-bottom: var(--a-footer-reserved-height)",
		);
		expect(appSource).toMatch(/\.app-main\s*\{[^}]*flex:\s*1 0 auto;/);
	});

	it("hides the footer on mobile sidebar routes without reserving footer space", () => {
		expect(mobileBlock).toContain("--a-footer-reserved-height: 0px;");
		expect(mobileBlock).not.toContain(
			"--a-footer-reserved-height: calc(112px + env(safe-area-inset-bottom, 0px));",
		);
		expect(mobileBlock).toContain(".app-shell.has-sidebar .site-footer");
		expect(mobileBlock).toContain("display: none;");
	});

	it("keeps the fixed player above the footer and mobile navigation", () => {
		expect(playerSource).toContain(
			"bottom: calc(var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height))",
		);
	});
});
