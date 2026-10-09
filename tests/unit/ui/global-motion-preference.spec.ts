import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("global motion preference", () => {
	it("reduces mobile route transition duration for the OS reduced-motion preference", () => {
		for (const path of ["apps/mobile/MobileApp.vue", "apps/mobile/mobileModules.css"]) {
			const source = readFileSync(resolve(process.cwd(), path), "utf8");
			expect(source).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transition-duration:\s*1ms;/);
		}
	});

	it("uses the shared motion token for music tag arrows", () => {
		const musicTagsView = readFileSync(
			resolve(process.cwd(), "src/views/music/MusicTagsView.vue"),
			"utf8",
		);

		expect(musicTagsView).toMatch(/\.music-tags-view__tag-arrow\s*\{[^}]*transition:\s*transform var\(--a-motion-micro\)/);
	});
});
