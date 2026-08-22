import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { commonmarkLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";

const collabMockState = vi.hoisted(() => ({
	initialText: "",
	asyncText: "",
	asyncMergedText: "",
	neverSync: false,
	urls: [] as string[],
}));

vi.mock("y-websocket", () => {
	class MockAwareness {
		clientID = 1;
		doc = { clientID: 1 };
		private states = new Map<number, Record<string, unknown>>();
		private localState: Record<string, unknown> = {};

		on() {}

		off() {}

		getStates() {
			return this.states;
		}

		getLocalState() {
			return this.localState;
		}

		setLocalStateField(field: string, value: unknown) {
			this.localState = { ...this.localState, [field]: value };
			this.states.set(this.clientID, this.localState);
		}
	}

	class WebsocketProvider {
		awareness = new MockAwareness();
		private syncListeners: Array<(isSynced: boolean) => void> = [];

		constructor(
			url: string,
			_roomId: string,
			doc: {
				getText: (name: string) => {
					length: number;
					insert: (index: number, text: string) => void;
					delete: (index: number, length: number) => void;
				};
			},
		) {
			collabMockState.urls.push(url);
			if (collabMockState.initialText) {
				const text = doc.getText("codemirror");
				if (text.length === 0) {
					text.insert(0, collabMockState.initialText);
				}
			}

			if (collabMockState.neverSync) return;

			window.setTimeout(() => {
				const text = doc.getText("codemirror");

				if (collabMockState.asyncText) {
					if (text.length > 0) {
						text.delete(0, text.length);
					}
					text.insert(0, collabMockState.asyncText);
				}
				if (collabMockState.asyncMergedText) {
					text.insert(text.length, collabMockState.asyncMergedText);
				}

				this.syncListeners.forEach((listener) => listener(true));
			}, 0);
		}

		on(event: string, listener: (isSynced: boolean) => void) {
			if (event === "sync") {
				this.syncListeners.push(listener);
			}
		}

		destroy() {}
	}

	return { WebsocketProvider };
});

// @ts-expect-error Vitest resolves Vue SFC imports through Vite.
import PEditor from "../../../src/components/shared/PEditor.vue";
import {
	resourceReferenceExtension,
	updateResourceReferenceLabels,
	type ResourceReferenceLabels,
} from "../../../src/components/shared/editor/resourceReferenceExtension";

// Task 1 先固定统一编辑器的最小未来契约，后续 Task 2 再让实现对齐这些 props 和语义标识。
const FUTURE_NORMAL_MODE = "normal";
const FUTURE_SPLIT_MODE = "split";
const FUTURE_EDITOR_ROOT = '[data-testid="markdown-editor"]';
const FUTURE_SOURCE_SURFACE = '[data-testid="markdown-source"]';
const FUTURE_PREVIEW_PANE = '[data-testid="markdown-preview"]';
const FUTURE_MODE_TOGGLE = '[data-testid="editor-mode-toggle"]';
const ALBUM_ID = "01900000-0000-7000-8000-000000000001";
const ALBUM_REFERENCE = `@album:${ALBUM_ID}`;
const DEBATE_ID = "01900000-0000-7000-8000-000000000002";
const DEBATE_REFERENCE = `@debate:${DEBATE_ID}:support`;
const mountedWrappers: VueWrapper[] = [];
let pinia: ReturnType<typeof createPinia>;
let consoleWarn: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;

if (!Range.prototype.getClientRects) {
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value: () => [] as unknown as DOMRectList,
	});
}

Object.defineProperty(document, "compatMode", {
	configurable: true,
	value: "CSS1Compat",
});

async function flushCollabSync() {
	vi.useFakeTimers();
	await vi.runAllTimersAsync();
	await nextTick();
	vi.useRealTimers();
}

async function mountEditor(props: Record<string, unknown>) {
	const wrapper = mount(PEditor, {
		props,
		global: { plugins: [pinia] },
	});
	mountedWrappers.push(wrapper);
	await vi.dynamicImportSettled();
	await nextTick();
	return wrapper;
}

describe("PEditor", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		collabMockState.initialText = "";
		collabMockState.asyncText = "";
		collabMockState.asyncMergedText = "";
		collabMockState.neverSync = false;
		collabMockState.urls = [];
		consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
		expect(consoleWarn).not.toHaveBeenCalled();
		expect(consoleError).not.toHaveBeenCalled();
		consoleWarn.mockRestore();
		consoleError.mockRestore();
	});

	it("renders CodeMirror editor in normal mode without preview pane", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
		});

		expect(wrapper.find(".cm-editor").exists()).toBe(true);
		expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(false);
	});

	it("renders preview pane in split mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "# title",
			mode: FUTURE_SPLIT_MODE,
		});

		expect(
			wrapper
				.find(`${FUTURE_EDITOR_ROOT}[data-editor-mode="${FUTURE_SPLIT_MODE}"]`)
				.exists(),
		).toBe(true);
		expect(wrapper.find(FUTURE_SOURCE_SURFACE).exists()).toBe(true);
		expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(true);
	});

	it("switches live preview decorations without changing the Markdown document", async () => {
		const wrapper = await mountEditor({
			modelValue: "# Title\n\n**bold**",
			mode: FUTURE_NORMAL_MODE,
			livePreview: false,
		});
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		)!;
		expect(wrapper.find(".cm-content").text()).toContain("**bold**");

		await wrapper.setProps({ livePreview: true });
		await nextTick();

		expect(view.state.doc.toString()).toBe("# Title\n\n**bold**");
		expect(wrapper.find(".cm-content").text()).not.toContain("**bold**");
	});

	it("renders standalone media as an editable visual widget", async () => {
		const markdown = "# Title\n\n![Cover](https://example.com/cover.png)";
		const wrapper = await mountEditor({
			modelValue: markdown,
			mode: FUTURE_NORMAL_MODE,
			livePreview: true,
		});
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		)!;
		const widget = wrapper.get(".cm-markdown-widget");
		expect(widget.get("img").attributes("src")).toBe(
			"https://example.com/cover.png",
		);

		await widget.trigger("click");
		await nextTick();

		expect(view.state.doc.toString()).toBe(markdown);
		expect(wrapper.find(".cm-markdown-widget").exists()).toBe(false);
		expect(wrapper.find(".cm-content").text()).toContain("![Cover]");
	});

	it("renders fenced code blocks without changing their Markdown source", async () => {
		const markdown = "# Title\n\n```ts\nconst answer = 42\n```";
		const wrapper = await mountEditor({
			modelValue: markdown,
			mode: FUTURE_NORMAL_MODE,
			livePreview: true,
		});
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		)!;

		expect(wrapper.get(".cm-markdown-widget").find("pre").exists()).toBe(true);
		expect(view.state.doc.toString()).toBe(markdown);
	});

	it("renders tables and mathematics from the same Markdown document", async () => {
		const markdown = [
			"# Title",
			"",
			"| A | B |",
			"|---|---|",
			"| 1 | 2 |",
			"",
			"$$",
			"x^2",
			"$$",
		].join("\n");
		const wrapper = await mountEditor({
			modelValue: markdown,
			mode: FUTURE_NORMAL_MODE,
			livePreview: true,
		});
		await vi.dynamicImportSettled();
		await nextTick();

		expect(wrapper.find(".cm-markdown-widget table").exists()).toBe(true);
		expect(wrapper.find(".cm-markdown-widget .katex").exists()).toBe(true);
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		)!;
		expect(view.state.doc.toString()).toBe(markdown);
	});

	it("opens preview without reconnecting the collaborative document", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		await wrapper.setProps({ mode: FUTURE_SPLIT_MODE });
		await nextTick();

		expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(true);
		expect(collabMockState.urls).toEqual([
			"ws://localhost:3000/api/v1/collab/ws",
		]);
	});

	it("shows mode toggle when enabled", async () => {
		const wrapper = await mountEditor({
			modelValue: "",
			mode: FUTURE_NORMAL_MODE,
			showModeToggle: true,
		});

		expect(wrapper.find(FUTURE_MODE_TOGGLE).exists()).toBe(true);
	});

	it("syncs external modelValue into CodeMirror in normal mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
		});

		await wrapper.setProps({ modelValue: "synced from parent" });
		await nextTick();

		expect(wrapper.find(".cm-content").text()).toContain("synced from parent");
	});

	it("emits update:modelValue when replaceDocument is called in normal mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
		});

		wrapper.vm.replaceDocument("replaced from api");
		await nextTick();

		expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
			"replaced from api",
		]);
		expect(wrapper.find(".cm-content").text()).toContain("replaced from api");
	});

	it("keeps the built-in line-number toggle uncontrolled for other editors", async () => {
		const wrapper = await mountEditor({
			modelValue: "first\nsecond",
			mode: FUTURE_SPLIT_MODE,
		});
		expect(wrapper.find(".cm-lineNumbers").exists()).toBe(false);

		const toggle = wrapper
			.findAll("button")
			.find((button) => button.attributes("title") === "行号")!;
		await toggle.trigger("click");
		await nextTick();
		expect(wrapper.find(".cm-lineNumbers").exists()).toBe(true);
	});

	it("uses the controlled line-number state without changing the shared default", async () => {
		const wrapper = await mountEditor({
			modelValue: "first\nsecond",
			mode: FUTURE_NORMAL_MODE,
			lineNumbers: true,
		});
		expect(wrapper.find(".cm-lineNumbers").exists()).toBe(true);

		await wrapper.setProps({ lineNumbers: false });
		await nextTick();
		expect(wrapper.find(".cm-lineNumbers").exists()).toBe(false);
	});

	it("keeps protected title spacing inside the measured live-preview line box", async () => {
		const wrapper = await mountEditor({
			modelValue: "# title\nbody",
			mode: FUTURE_NORMAL_MODE,
			protectFirstLine: true,
			lineNumbers: true,
			livePreview: true,
		});
		const codeMirrorStyles = Array.from(document.querySelectorAll("style"))
			.map((style) => style.textContent || "")
			.join("\n");

		expect(wrapper.attributes("data-live-preview")).toBe("true");
		expect(codeMirrorStyles).toContain("padding-bottom: 0.75rem");
		expect(codeMirrorStyles).not.toContain("margin-bottom: 0.75rem");
	});

	it("preserves the full line when applying a line prefix from the middle", async () => {
		const wrapper = await mountEditor({
			modelValue: "# title\nabcdef",
			mode: FUTURE_NORMAL_MODE,
			protectFirstLine: true,
		});
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		)!;
		const cursor = view.state.doc.line(2).from + 3;
		view.dispatch({ selection: { anchor: cursor } });

		wrapper.vm.sv_wrapLinePrefix("## ", "标题");
		await nextTick();

		expect(view.state.doc.toString()).toBe("# title\n## abcdef");
		expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
			"# title\n## abcdef",
		]);
	});

	it("keeps collab sessions in the requested focused mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.attributes("data-editor-mode")).toBe(FUTURE_NORMAL_MODE);
		expect(wrapper.find(".cm-editor").exists()).toBe(true);
		expect(wrapper.find(FUTURE_PREVIEW_PANE).exists()).toBe(false);
		expect(collabMockState.urls).toEqual([
			"ws://localhost:3000/api/v1/collab/ws",
		]);
	});

	it("does not render the legacy internal mode toggle in collab mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello",
			mode: FUTURE_NORMAL_MODE,
			showModeToggle: true,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.find(FUTURE_MODE_TOGGLE).exists()).toBe(false);
		expect(wrapper.emitted("mode-change")).toBeUndefined();
	});

	it("renders sync scroll toggle in split mode when enabled", async () => {
		const wrapper = await mountEditor({
			modelValue: "# hello",
			mode: FUTURE_SPLIT_MODE,
			showSyncScrollToggle: true,
			syncScroll: true,
		});

		const syncToggle = wrapper.find(
			'[data-testid="editor-sync-scroll-toggle"]',
		);
		expect(syncToggle.exists()).toBe(true);
		expect(syncToggle.text()).toContain("跟随滚动");
	});

	it("updates mode toggle active state and label with current mode", async () => {
		const wrapper = await mountEditor({
			modelValue: "",
			mode: FUTURE_NORMAL_MODE,
			showModeToggle: true,
		});

		const modeToggle = wrapper.find(FUTURE_MODE_TOGGLE);
		expect(modeToggle.classes()).not.toContain("active");
		expect(modeToggle.attributes("aria-pressed")).toBe("false");
		expect(modeToggle.text()).toContain("关");

		await wrapper.setProps({ mode: FUTURE_SPLIT_MODE });
		await nextTick();

		expect(modeToggle.classes()).toContain("active");
		expect(modeToggle.attributes("aria-pressed")).toBe("true");
		expect(modeToggle.text()).toContain("开");
	});

	it("updates sync scroll toggle active state and label with syncScroll value", async () => {
		const wrapper = await mountEditor({
			modelValue: "# hello",
			mode: FUTURE_SPLIT_MODE,
			showSyncScrollToggle: true,
			syncScroll: false,
		});

		const syncToggle = wrapper.find(
			'[data-testid="editor-sync-scroll-toggle"]',
		);
		expect(syncToggle.classes()).not.toContain("active");
		expect(syncToggle.attributes("aria-pressed")).toBe("false");
		expect(syncToggle.text()).toContain("关");

		await wrapper.setProps({ syncScroll: true });
		await nextTick();

		expect(syncToggle.classes()).toContain("active");
		expect(syncToggle.attributes("aria-pressed")).toBe("true");
		expect(syncToggle.text()).toContain("开");
	});

	it("seeds an empty collab document from modelValue on first mount", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello collab",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.find(".cm-content").text()).toContain("hello collab");
	});

	it("uses the local model when collab does not sync", async () => {
		collabMockState.neverSync = true;
		vi.useFakeTimers();

		const wrapper = await mountEditor({
			modelValue: "# 本地标题\n正文内容",
			mode: FUTURE_NORMAL_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
			protectFirstLine: true,
		});

		await nextTick();
		await vi.advanceTimersByTimeAsync(1500);
		await nextTick();
		vi.useRealTimers();

		expect(wrapper.find(".cm-content").text()).toContain("本地标题");
		expect(wrapper.find(".cm-content").text()).toContain("正文内容");
	});

	it("does not overwrite existing collab document content with modelValue", async () => {
		collabMockState.initialText = "shared copy";

		const wrapper = await mountEditor({
			modelValue: "local draft",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.find(".cm-content").text()).toContain("shared copy");
		expect(wrapper.find(".cm-content").text()).not.toContain("local draft");
	});

	it("does not duplicate modelValue when the same shared content arrives during sync", async () => {
		collabMockState.asyncMergedText = "same copy";

		const wrapper = await mountEditor({
			modelValue: "same copy",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.emitted("collab-ready")).toEqual([["same copy"]]);
		expect(wrapper.find(".cm-content").text()).toContain("same copy");
		expect(wrapper.find(".cm-content").text()).not.toContain(
			"same copysame copy",
		);
	});

	it("emits collab-ready only after async shared content becomes readable", async () => {
		collabMockState.asyncText = "shared async copy";

		const wrapper = await mountEditor({
			modelValue: "hello collab",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});

		expect(wrapper.emitted("collab-ready")).toBeUndefined();

		await flushCollabSync();

		expect(wrapper.emitted("collab-ready")).toEqual([["shared async copy"]]);
		expect(wrapper.find(".cm-content").text()).toContain("shared async copy");
		expect(wrapper.find(".cm-content").text()).not.toContain("hello collab");
	});

	it("emits collab-ready with existing shared content instead of local modelValue", async () => {
		collabMockState.initialText = "shared copy";

		const wrapper = await mountEditor({
			modelValue: "local draft",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		expect(wrapper.emitted("collab-ready")).toBeUndefined();

		await flushCollabSync();

		expect(wrapper.emitted("collab-ready")).toEqual([["shared copy"]]);
	});

	it("emits collab-ready only once after collab content becomes readable", async () => {
		collabMockState.initialText = "shared copy";

		const wrapper = await mountEditor({
			modelValue: "local draft",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();
		await flushCollabSync();

		expect(wrapper.emitted("collab-ready")).toEqual([["shared copy"]]);
	});

	it("replaces the whole document when replaceDocument is called", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello collab",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.find(".cm-content").text()).toContain("hello collab");

		wrapper.vm.replaceDocument("restored draft");
		await nextTick();

		expect(wrapper.find(".cm-content").text()).toContain("restored draft");
		expect(wrapper.find(".cm-content").text()).not.toContain("hello collab");
	});

	it("clears the whole document when replaceDocument is called with an empty string", async () => {
		const wrapper = await mountEditor({
			modelValue: "hello collab",
			mode: FUTURE_SPLIT_MODE,
			enableCollab: true,
			collabRoomId: "room-1",
		});
		await flushCollabSync();

		expect(wrapper.find(".cm-content").text()).toContain("hello collab");

		wrapper.vm.replaceDocument("");
		await nextTick();

		expect(wrapper.find(".cm-placeholder").text()).toBe("开始输入…");
		expect(wrapper.find(".cm-content").text()).not.toContain("hello collab");

		wrapper.vm.replaceDocument("restored draft");
		await nextTick();

		expect(wrapper.find(".cm-content").text()).toContain("restored draft");
	});

	it("renders without error with renderingLevel comment", async () => {
		const wrapper = await mountEditor({
			modelValue: "**bold** and _italic_",
			mode: FUTURE_NORMAL_MODE,
			renderingLevel: "comment",
		});
		expect(wrapper.find(FUTURE_EDITOR_ROOT).exists()).toBe(true);
		expect(wrapper.find(".cm-content").exists()).toBe(true);
	});

	it("开启后把已解析资源显示为行内引用块且保留原始源码", async () => {
		const wrapper = await mountEditor({
			modelValue: ALBUM_REFERENCE,
			mode: FUTURE_NORMAL_MODE,
			enableResourceReferences: true,
			resourceReferenceLabels: {
				[`album:${ALBUM_ID}`]: { title: "Kind of Blue" },
			},
		});

		const reference = wrapper.get(
			`[data-resource-reference="album:${ALBUM_ID}"]`,
		);
		const view = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		);
		expect(reference.text()).toContain("Kind of Blue");
		expect(reference.text()).toContain("专辑");
		expect(reference.attributes("data-resource-reference-state")).toBe(
			"active",
		);
		expect(view?.state.doc.toString()).toBe(ALBUM_REFERENCE);

		wrapper.vm.replaceDocument(`${ALBUM_REFERENCE}\n补充说明`);
		await nextTick();

		expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
			`${ALBUM_REFERENCE}\n补充说明`,
		]);
		expect(view?.state.doc.toString()).toBe(`${ALBUM_REFERENCE}\n补充说明`);
	});

	it("光标进入引用范围时恢复原始标记", async () => {
		const prefix = "证据：";
		const parent = document.createElement("div");
		document.body.appendChild(parent);
		const view = new EditorView({
			state: EditorState.create({
				doc: `${prefix}${ALBUM_REFERENCE}`,
				extensions: [
					resourceReferenceExtension({
						[`album:${ALBUM_ID}`]: { title: "Kind of Blue" },
					}),
				],
			}),
			parent,
		});
		expect(
			parent.querySelector(`[data-resource-reference="album:${ALBUM_ID}"]`),
		).not.toBeNull();

		view.focus();
		view.dispatch({ selection: { anchor: prefix.length + 2 } });
		await nextTick();

		expect(
			parent.querySelector(`[data-resource-reference="album:${ALBUM_ID}"]`),
		).toBeNull();
		expect(view.contentDOM.textContent).toContain(ALBUM_REFERENCE);
		expect(view.state.doc.toString()).toBe(`${prefix}${ALBUM_REFERENCE}`);
		view.destroy();
		parent.remove();
	});

	it("labels 更新时原地刷新引用标题和状态", async () => {
		const key = `album:${ALBUM_ID}`;
		const wrapper = await mountEditor({
			modelValue: ALBUM_REFERENCE,
			mode: FUTURE_NORMAL_MODE,
			enableResourceReferences: true,
			resourceReferenceLabels: {
				[key]: { title: "旧标题" },
			},
		});
		const originalView = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		);

		await wrapper.setProps({
			resourceReferenceLabels: {
				[key]: { title: "新标题", state: "stale" },
			},
		});
		await nextTick();

		const reference = wrapper.get(`[data-resource-reference="${key}"]`);
		expect(reference.text()).toContain("新标题");
		expect(reference.text()).toContain("待确认");
		expect(reference.classes()).toContain("resource-reference--stale");
		expect(reference.attributes("data-resource-reference-state")).toBe("stale");
		expect(
			EditorView.findFromDOM(wrapper.get(".cm-content").element as HTMLElement),
		).toBe(originalView);
	});

	it("labels 深层原地修改时刷新现有引用块", async () => {
		const key = `debate:${DEBATE_ID}`;
		const labels = reactive<ResourceReferenceLabels>({
			[key]: {
				title: "旧辩题",
				state: "active",
				qualifierLabel: "赞成",
			},
		});
		const wrapper = await mountEditor({
			modelValue: DEBATE_REFERENCE,
			mode: FUTURE_NORMAL_MODE,
			enableResourceReferences: true,
			resourceReferenceLabels: labels,
		});
		const originalView = EditorView.findFromDOM(
			wrapper.get(".cm-content").element as HTMLElement,
		);

		labels[key].title = "新辩题";
		labels[key].state = "stale";
		labels[key].qualifierLabel = "支撑";
		await nextTick();

		const reference = wrapper.get(`[data-resource-reference="${key}"]`);
		expect(reference.text()).toContain("新辩题");
		expect(reference.text()).toContain("支撑");
		expect(reference.text()).toContain("待确认");
		expect(reference.classes()).toContain("resource-reference--stale");
		expect(reference.attributes("data-resource-reference-state")).toBe("stale");
		expect(
			EditorView.findFromDOM(wrapper.get(".cm-content").element as HTMLElement),
		).toBe(originalView);
	});

	it("仅在文档变化时重新解析资源引用语法", () => {
		const key = `album:${ALBUM_ID}`;
		const parent = document.createElement("div");
		document.body.appendChild(parent);
		const parseSpy = vi.spyOn(commonmarkLanguage.parser, "parse");
		const view = new EditorView({
			state: EditorState.create({
				doc: `证据：${ALBUM_REFERENCE}`,
				extensions: [
					resourceReferenceExtension({
						[key]: { title: "旧标题" },
					}),
				],
			}),
			parent,
		});

		try {
			parseSpy.mockClear();
			view.focus();
			view.dispatch({ selection: { anchor: 5 } });
			view.dispatch({ selection: { anchor: 0 } });
			view.dispatch({
				effects: updateResourceReferenceLabels.of({
					[key]: { title: "新标题", state: "stale" },
				}),
			});

			expect(parseSpy).not.toHaveBeenCalled();
			expect(
				parent.querySelector(`[data-resource-reference="${key}"]`)?.textContent,
			).toContain("新标题");

			view.dispatch({ changes: { from: 0, insert: "新增 " } });

			expect(parseSpy).toHaveBeenCalledTimes(1);
			expect(view.state.doc.toString()).toBe(`新增 证据：${ALBUM_REFERENCE}`);
			expect(
				parent.querySelector(`[data-resource-reference="${key}"]`),
			).not.toBeNull();
		} finally {
			view.destroy();
			parent.remove();
			parseSpy.mockRestore();
		}
	});

	it("默认关闭资源引用装饰", async () => {
		const wrapper = await mountEditor({
			modelValue: ALBUM_REFERENCE,
			mode: FUTURE_NORMAL_MODE,
			resourceReferenceLabels: {
				[`album:${ALBUM_ID}`]: { title: "Kind of Blue" },
			},
		});

		expect(
			wrapper.find(`[data-resource-reference="album:${ALBUM_ID}"]`).exists(),
		).toBe(false);
		expect(wrapper.get(".cm-content").text()).toContain(ALBUM_REFERENCE);
	});

	it("把可访问名称绑定到真实 CodeMirror textbox", async () => {
		const wrapper = await mountEditor({
			modelValue: "",
			mode: FUTURE_NORMAL_MODE,
			editorAriaLabel: "辩题正文",
		});

		expect(
			wrapper.get('.cm-content[role="textbox"]').attributes("aria-label"),
		).toBe("辩题正文");
	});

	it("在启用时显示空格和制表符标记", async () => {
		const wrapper = await mountEditor({
			modelValue: "正文  \t尾部",
			mode: FUTURE_NORMAL_MODE,
			showWhitespace: true,
		});

		expect(wrapper.find(".cm-highlightSpace").exists()).toBe(true);
		expect(wrapper.find(".cm-highlightTab").exists()).toBe(true);
	});

	it("opens root suggestions from the reference tool", async () => {
		vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));
		const wrapper = await mountEditor({
			modelValue: "",
			mode: FUTURE_NORMAL_MODE,
			enableMentions: true,
		});
		const button = wrapper.get('[data-testid="editor-reference-trigger"]');
		expect(button.attributes("aria-label")).toBe("添加引用");

		await button.trigger("click");
		await nextTick();

		expect(wrapper.find(".cm-content").text()).toContain("@");
		expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
	});

	it("ignores selection keys while reference suggestions are still loading", async () => {
		vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));
		const wrapper = await mountEditor({
			modelValue: "",
			mode: FUTURE_NORMAL_MODE,
			enableMentions: true,
		});

		const view = EditorView.findFromDOM(
			wrapper.find(".cm-editor").element as HTMLElement,
		);
		view?.dispatch({
			changes: { from: 0, insert: "@" },
			selection: { anchor: 1 },
		});
		await nextTick();

		expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
		await expect(
			wrapper.find(FUTURE_EDITOR_ROOT).trigger("keydown", { key: "Enter" }),
		).resolves.toBeUndefined();
	});
});
