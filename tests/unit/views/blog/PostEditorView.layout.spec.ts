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

	it("keeps a single editor column and exposes publication actions from the topbar", () => {
		expect(source).not.toContain("PostEditorSidebar");
		expect(source).not.toContain('@toggle-sidebar="toggleSidebarPanel"');
		expect(source).toContain('@save-published="handlePublishAction"');
		expect(source).not.toContain('@confirm="confirmPublication"');
		expect(source).toContain(':publication-open="publicationReviewVisible"');
		expect(cssRules(".editor-layout")).toContain(
			"grid-template-columns: minmax(0, 1fr)",
		);
	});

	it("uses one Markdown document for source, visual editing, and preview", () => {
		expect(source).toContain("PostEditorFormattingToolbar");
		expect(source).toContain('<div class="editor-format-row">');
		expect(source).toContain('<div class="editor-top-info"');
		expect(source).not.toContain("PostEditorRichText");
		expect(source).toContain(
			"const contentMode = ref<'markdown' | 'visual'>('markdown')",
		);
		expect(source).toContain("Visual");
		expect(source).toContain("const previewOpen = ref(false)");
		expect(source).toContain(":mode=\"previewOpen ? 'split' : 'normal'\"");
		expect(source).toContain(":live-preview=\"contentMode === 'visual'\"");
		expect(source).toContain("const lineNumbersVisible = ref(true)");
		expect(source).toContain("overflow-y: auto !important");
	});

	it("shows a retryable failure state instead of leaving the editor blank", () => {
		expect(source).toContain("const editorLoadFailed = ref(false)");
		expect(source).toContain('v-if="editorLoadFailed"');
		expect(source).toContain('@click="void initializeEditor()"');
		expect(source).toContain("编辑器加载失败，请刷新重试");
	});

	it("does not constrain the editor page with the generic sidebar content width", () => {
		expect(globalStyle).toMatch(
			/\.a-content-frame > \.editor-page[\s\S]*?max-width: none/,
		);
		expect(globalStyle).toMatch(
			/\.a-content-frame > \.editor-page[\s\S]*?padding: 0/,
		);
	});

	it("uses a narrow publication sheet above the Studio route sheet", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/views/blog/PostEditorView.vue"),
			"utf8",
		);

		expect(source).toContain('<PModal v-if="draftManagerVisible" above-player');
		expect(source).toContain('<PModal v-if="leaveConfirmVisible" above-player');
		expect(source).toContain("<PostPublicationSheet");
		expect(source).toContain(":show=\"publicationReviewVisible\"");
		expect(source).toContain('@update:intent="publicationIntent = $event"');
	});
});
