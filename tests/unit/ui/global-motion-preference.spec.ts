import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("global motion preference", () => {
	it("reduces mobile route transition duration for the OS reduced-motion preference", () => {
		const app = readFileSync(resolve(process.cwd(), "apps/mobile/MobileApp.vue"), "utf8");
		expect(app).toContain("import './mobileRouteMotion.css'");
		const motionStyles = readFileSync(resolve(process.cwd(), "apps/mobile/mobileRouteMotion.css"), "utf8");
		expect(motionStyles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transition-duration:\s*1ms;/);
	});

	it("uses the shared motion token for music tag arrows", () => {
		const musicTagsView = readFileSync(
			resolve(process.cwd(), "src/views/music/MusicTagsView.vue"),
			"utf8",
		);

		expect(musicTagsView).toMatch(/\.music-tags-view__tag-arrow\s*\{[^}]*transition:\s*transform var\(--a-motion-micro\)/);
	});
});
