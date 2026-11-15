import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { EditorView } from "@codemirror/view";
import { useEditorImageUpload } from "@/composables/editor/useEditorImageUpload";
import { useAuthStore } from "@/stores/auth";

function createView(initial = "正文") {
	let text = initial;
	const view = {
		state: {
			selection: { main: { from: text.length } },
			doc: { toString: () => text },
		},
		dispatch(spec: { changes: { from: number; to?: number; insert: string } }) {
			const { from, to = from, insert } = spec.changes;
			text = text.slice(0, from) + insert + text.slice(to);
			view.state.selection.main.from = from + insert.length;
		},
		get text() {
			return text;
		},
	};
	return view;
}

function mountUpload(view: ReturnType<typeof createView>) {
	let api: ReturnType<typeof useEditorImageUpload> | undefined;
	const wrapper = mount(defineComponent({
		setup() {
			api = useEditorImageUpload({
				enabled: () => true,
				getView: () => view as unknown as EditorView,
			});
			return () => null;
		},
	}));
	if (!api) throw new Error("upload api missing");
	return { wrapper, api };
}

describe("useEditorImageUpload", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		const auth = useAuthStore();
		auth.token = "token";
	});

	it("拒绝超过后端 5MB 限制的图片，并且不写入正文", async () => {
		const view = createView();
		const { api } = mountUpload(view);
		const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });

		await api.handleImageUploadFile({ target: { files: [file] } } as unknown as Event);

		expect(api.uploadError.value).toBe("图片不能超过 5MB");
		expect(view.text).toBe("正文");
	});

	it("上传失败时移除占位符并显示服务端原因", async () => {
		const view = createView();
		const { api } = mountUpload(view);
		vi.stubGlobal("fetch", vi.fn(async () => new Response(
			JSON.stringify({ error: "Image must be smaller than 5 MB" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		)));
		const file = new File([new Uint8Array([1, 2, 3])], "shot].png", { type: "image/png" });

		await api.handleImageUploadFile({ target: { files: [file] } } as unknown as Event);
		await flushPromises();

		expect(api.uploadError.value).toBe("Image must be smaller than 5 MB");
		expect(view.text).toBe("正文");
		expect(view.text).not.toContain("undefined");
	});

	it("成功上传后写入不含方括号的图片语法", async () => {
		const view = createView();
		const { api } = mountUpload(view);
		vi.stubGlobal("fetch", vi.fn(async () => new Response(
			JSON.stringify({ url: "https://cdn.example/shot.png" }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		)));
		const file = new File([new Uint8Array([1, 2, 3])], "shot].png", { type: "image/png" });

		await api.handleImageUploadFile({ target: { files: [file] } } as unknown as Event);
		await flushPromises();

		expect(api.uploadError.value).toBe("");
		expect(view.text).toBe("正文![shot](https://cdn.example/shot.png)");
	});
});
