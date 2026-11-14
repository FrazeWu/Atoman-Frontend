import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sidebarLayouts = [
	"../../../src/views/video/VideoLayout.vue",
	"../../../src/views/blog/BlogLayout.vue",
	"../../../src/views/podcast/PodcastLayout.vue",
] as const;

describe("content layout shells", () => {
	it("restores sidebars for blog, podcast and video modules", () => {
		for (const filePath of sidebarLayouts) {
			const source = readFileSync(resolve(__dirname, filePath), "utf8");
			expect(source).toContain("<PSidebar");
			expect(source).toContain("from '@/components/ui/PSidebar.vue'");
		}
	});

	it("adds the shared Studio creation entry to all three modules", () => {
		for (const filePath of sidebarLayouts) {
			const source = readFileSync(resolve(__dirname, filePath), "utf8");
			expect(source).toContain("<ModuleCreateAction");
			expect(source).toContain(
				"from '@/components/studio/ModuleCreateAction.vue'",
			);
		}
	});

	it("preserves sidebar width contracts for studio layout and mail workspace", () => {
		const globalStyle = readFileSync(
			resolve(__dirname, "../../../src/style.css"),
			"utf8",
		);
		expect(globalStyle).toMatch(/body:has\(\.studio-layout\)[\s\S]*?--a-sidebar-width:\s*12rem/);
		expect(globalStyle).toMatch(/body:has\(\.studio-layout\.is-sidebar-collapsed\)[\s\S]*?--a-sidebar-width:\s*var\(--a-sidebar-collapsed-width\)/);
		expect(globalStyle).toMatch(/body:has\(\.mail-page\)[\s\S]*?--a-sidebar-width:\s*220px/);
		expect(globalStyle).toMatch(/body:has\(\.mail-workspace\)[\s\S]*?--a-sidebar-width:\s*220px/);
	});
});
