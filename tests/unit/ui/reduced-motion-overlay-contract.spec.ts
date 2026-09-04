import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("reduced-motion overlay contract", () => {
	it("keeps shared popup entry effects perceptible", () => {
		const style = read("src/style.css");
		const footer = read("src/components/system/footer/SiteFooterSheet.vue");
		const search = read("src/components/system/AppTopbarGlobalSearch.vue");
		const lightbox = read("src/components/ui/PImageLightbox.vue");
		const tooltip = read("src/components/ui/PHelpTooltip.vue");

		expect(style).toContain("--a-motion-reduced-state: 240ms;");
		expect(style).toContain("--a-motion-reduced-overlay: 320ms;");
		expect(footer).toContain(
			"transition-duration: var(--a-motion-reduced-overlay) !important;",
		);
		expect(search).toContain(
			"animation-duration: var(--a-motion-reduced-state);",
		);
		expect(search).not.toMatch(
			/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/,
		);
		expect(lightbox).toContain(
			"transition-duration: var(--a-motion-reduced-state);",
		);
		expect(lightbox).toMatch(
			/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform:\s*scale\(0\.98\)/,
		);
		expect(tooltip).toContain(
			"animation-duration: var(--a-motion-reduced-state);",
		);
	});
});
