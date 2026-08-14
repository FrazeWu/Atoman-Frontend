import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("media editor upload layering", () => {
	it("delegates podcast progress uploads to the API layer", () => {
		const source = readFileSync(
			path.resolve(process.cwd(), "src/views/podcast/PodcastEditorView.vue"),
			"utf8",
		);

		expect(source).toContain(
			"import { uploadFormDataWithProgress } from '@/api/upload'",
		);
		expect(source).not.toContain("function uploadWithProgress(");
		expect(source).not.toContain("configureApiXHR");
	});

	it("delegates video progress uploads to the video import composable", () => {
		const source = readFileSync(
			path.resolve(process.cwd(), "src/views/video/VideoEditorView.vue"),
			"utf8",
		);

		expect(source).toContain(
			"import { useVideoImportUpload } from '@/composables/useVideoImportUpload'",
		);
		expect(source).not.toContain("function uploadWithProgress(");
		expect(source).not.toContain("configureApiXHR");
	});

	it.each([
		"src/views/podcast/PodcastEditorView.vue",
		"src/views/video/VideoEditorView.vue",
	])("%s delegates creation step transitions to a composable", (file) => {
		const source = readFileSync(path.resolve(process.cwd(), file), "utf8");

		expect(source).toContain(
			"import { useMediaCreationSteps } from '@/composables/useMediaCreationSteps'",
		);
		expect(source).not.toContain("const currentStep = ref(");
		expect(source).not.toContain("const creationSteps = [");
		expect(source).not.toContain("function goNext()");
		expect(source).not.toContain("function goPrevious()");
	});
});
