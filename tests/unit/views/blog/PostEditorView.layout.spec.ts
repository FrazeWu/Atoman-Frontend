import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	resolve(process.cwd(), "src/views/blog/PostEditorView.vue"),
	"utf8",
);
const globalStyle = readFileSync(
	resolve(process.cwd(), "src/style.css"),
	"utf8",
);

function cssRules(selector: string, css = source) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return Array.from(
		css.matchAll(new RegExp(`${escaped} \\{[\\s\\S]*?\\}`, "g")),
		(match) => match[0],
	).join("\n");
}

describe("PostEditorView layout", () => {
	it("lets the editor surface fill the available blog workspace width", () => {
		expect(cssRules(".col-center")).toContain("display: flex");
		expect(cssRules(".col-center")).toContain("min-width: 0");
		expect(cssRules(".editor-workspace")).toContain("flex: 1");
		expect(cssRules(".editor-canvas")).toContain("flex: 1");
	});

	it("starts focused and expands settings and outline independently from the topbar", () => {
		expect(source).toContain("const settingsPanelOpen = ref(false)");
		expect(source).toContain("const outlinePanelOpen = ref(false)");
		expect(source).toContain('@toggle-settings="toggleSettingsPanel"');
		expect(source).toContain('@toggle-outline="toggleOutlinePanel"');
		expect(cssRules(".editor-layout")).toContain(
			"grid-template-columns: 0 minmax(0, 1fr) 0",
		);
		expect(cssRules(".editor-layout.has-settings-panel")).toContain(
			"grid-template-columns: 17.5rem minmax(0, 1fr) 0",
		);
		expect(cssRules(".editor-layout.has-outline-panel")).toContain(
			"grid-template-columns: 0 minmax(0, 1fr) 15rem",
		);
	});

	it("keeps publishing separate from settings with a dedicated right outline panel", () => {
		expect(source).toContain("PostEditorOutline");
		expect(source).toContain('class="editor-mobile-publish-actions"');
		expect(source).toContain(":mobile-open=\"mobilePanel === 'settings'\"");
		expect(source).toContain(":mobile-open=\"mobilePanel === 'outline'\"");
	});

	it("does not constrain the editor page with the generic sidebar content width", () => {
		expect(cssRules(".a-main-content > .editor-page", globalStyle)).toContain(
			"max-width: none",
		);
		expect(cssRules(".a-main-content > .editor-page", globalStyle)).toContain(
			"padding: 0",
		);
	});
});
