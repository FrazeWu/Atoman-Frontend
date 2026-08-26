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

	it("starts focused and opens one right sidebar from the topbar", () => {
		expect(source).toContain("const sidebarPanelOpen = ref(false)");
		expect(source).toContain('@toggle-sidebar="toggleSidebarPanel"');
		expect(cssRules(".editor-layout")).toContain(
			"grid-template-columns: minmax(0, 1fr) 0",
		);
		expect(cssRules(".editor-layout.has-sidebar-panel")).toContain(
			"grid-template-columns: minmax(0, 1fr) 17.5rem",
		);
	});

	it("uses one Markdown document for source, visual editing, and preview", () => {
		expect(source).toContain("PostEditorFormattingToolbar");
		expect(source).not.toContain("PostEditorRichText");
		expect(source).toContain(
			"const contentMode = ref<'markdown' | 'visual'>('markdown')",
		);
		expect(source).toContain("const previewOpen = ref(false)");
		expect(source).toContain(":mode=\"previewOpen ? 'split' : 'normal'\"");
		expect(source).toContain(":live-preview=\"contentMode === 'visual'\"");
		expect(source).toContain("const lineNumbersVisible = ref(true)");
		expect(source).toContain("const line = idx + 2");
		expect(source).toContain("mobilePanel !== 'sidebar'");
	});

	it("shows a retryable failure state instead of leaving the editor blank", () => {
		expect(source).toContain("const editorLoadFailed = ref(false)");
		expect(source).toContain('v-if="editorLoadFailed"');
		expect(source).toContain('@click="void initializeEditor()"');
		expect(source).toContain("编辑器加载失败，请刷新重试");
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
