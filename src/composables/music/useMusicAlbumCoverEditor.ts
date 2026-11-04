import { computed, onBeforeUnmount, ref, watch } from "vue";
import { uploadMusicAsset } from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { useMusicCreationFlow } from "@/components/music/musicCreationFlowContext";

export function useMusicAlbumCoverEditor() {
	const { state } = useMusicDrawers();
	const creationFlowFallback = computed(() => state.value.creationFlow);
	const creationFlow = useMusicCreationFlow(creationFlowFallback);
	const albumDetailsDraft = computed(
		() => creationFlow.value?.draft.albumDetails ?? null,
	);
	const albumImportDraft = computed(
		() => creationFlow.value?.draft.albumImport ?? null,
	);
	const coverInputRef = ref<HTMLInputElement | null>(null);
	const coverUploading = ref(false);
	const coverErrorMessage = ref("");
	const coverPreviewUrl = ref("");
	let uploadGeneration = 0;
	const pendingCoverCrop = ref<{
		kind: "manual" | "imported";
		sourceFile?: File | null;
		sourceUrl?: string;
	} | null>(null);

	const importedCoverUrl = computed(() =>
			albumImportDraft.value?.coverUrl?.trim() ||
			albumImportDraft.value?.derivedCover?.trim() ||
			"",
	);
	const unresolvedImportedCoverUrl = computed(() =>
		/^(blob:|data:)/i.test(importedCoverUrl.value) && !creationFlow.value?.coverCustomized
			? importedCoverUrl.value : "",
	);
	const coverDisplayUrl = computed(
		() =>
			coverPreviewUrl.value ||
			albumDetailsDraft.value?.coverUrl ||
			albumImportDraft.value?.derivedCover ||
			albumImportDraft.value?.coverUrl ||
			"",
	);

	function clearCoverPreviewUrl() {
		if (!coverPreviewUrl.value) return;
		URL.revokeObjectURL(coverPreviewUrl.value);
		coverPreviewUrl.value = "";
	}

	function queueImportedCoverCrop(sourceUrl: string) {
		const flow = creationFlow.value;
		if (!flow || !sourceUrl.trim()) return;
		pendingCoverCrop.value = { kind: "imported", sourceUrl };
	}

	function reopenImportedCoverCrop() {
		if (coverDisplayUrl.value) queueImportedCoverCrop(coverDisplayUrl.value);
	}

	async function adoptImportedCover() {
		const flow = creationFlow.value;
		const draft = albumDetailsDraft.value;
		const sourceUrl = importedCoverUrl.value;
		if (!flow || !draft || !sourceUrl || flow.coverCustomized || coverUploading.value || pendingCoverCrop.value?.kind === "manual") return;
		// 已有持久化封面优先，不用后台识别结果覆盖用户选择。
		if (draft.coverUrl && !/^(blob:|data:)/i.test(draft.coverUrl) && draft.coverUrl !== sourceUrl) return;
		if (!/^(blob:|data:)/i.test(sourceUrl)) {
			draft.coverUrl = sourceUrl;
			return;
		}
		const generation = ++uploadGeneration;
		coverUploading.value = true;
		coverErrorMessage.value = "";
		flow.assetUploading = true;
		try {
			const response = await fetch(sourceUrl);
			if (!response.ok) throw new Error("读取识别封面失败");
			const blob = await response.blob();
			if (generation !== uploadGeneration || creationFlow.value !== flow || flow.coverCustomized || importedCoverUrl.value !== sourceUrl) return;
			const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1] || "png";
			const file = new File([blob], `detected-cover.${extension}`, { type: blob.type });
			const asset = await uploadMusicAsset(file, "music.cover");
			if (generation !== uploadGeneration || creationFlow.value !== flow || flow.coverCustomized || importedCoverUrl.value !== sourceUrl) return;
			draft.coverAsset = asset;
			draft.coverUrl = asset.url;
			// 后续轮询仍优先保留本地识别封面，因此同时替换其临时地址。
			flow.draft.albumImport.coverUrl = asset.url;
			flow.draft.albumImport.derivedCover = asset.url;
		} catch (error) {
			if (generation === uploadGeneration && creationFlow.value === flow) {
				coverErrorMessage.value = error instanceof Error ? error.message : "识别封面上传失败";
			}
		} finally {
			if (generation === uploadGeneration) {
				coverUploading.value = false;
				flow.assetUploading = false;
				if (creationFlow.value === flow && importedCoverUrl.value !== sourceUrl) void adoptImportedCover();
			}
		}
	}

	async function confirmCoverCrop(file: File) {
		const flow = creationFlow.value;
		const draft = albumDetailsDraft.value;
		if (!flow || !draft) return;
		const generation = ++uploadGeneration;

		clearCoverPreviewUrl();
		coverPreviewUrl.value = URL.createObjectURL(file);
		coverUploading.value = true;
		coverErrorMessage.value = "";
		flow.assetUploading = true;
		pendingCoverCrop.value = null;
		flow.coverCustomized = true;

		try {
			const asset = await uploadMusicAsset(file, "music.cover");
			if (generation !== uploadGeneration || creationFlow.value !== flow) return;
			draft.coverAsset = asset;
			draft.coverUrl = asset.url;
			clearCoverPreviewUrl();
		} catch (error) {
			coverErrorMessage.value =
				error instanceof Error ? error.message : "封面上传失败";
		} finally {
			if (generation === uploadGeneration) {
				coverUploading.value = false;
				flow.assetUploading = false;
			}
		}
	}

	function onCoverChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) pendingCoverCrop.value = { kind: "manual", sourceFile: file };
		input.value = "";
	}

	watch(
		importedCoverUrl,
		() => { void adoptImportedCover(); },
		{ immediate: true },
	);

	onBeforeUnmount(() => {
		if (coverUploading.value && creationFlow.value) creationFlow.value.assetUploading = false;
		uploadGeneration++;
		clearCoverPreviewUrl();
	});

	return {
		coverInputRef,
		coverUploading,
		coverErrorMessage,
		coverDisplayUrl,
		pendingCoverCrop,
		unresolvedImportedCoverUrl,
		onCoverChange,
		reopenImportedCoverCrop,
		retryImportedCoverUpload: adoptImportedCover,
		confirmCoverCrop,
		clearPendingCoverCrop: () => {
			pendingCoverCrop.value = null;
		},
	};
}
