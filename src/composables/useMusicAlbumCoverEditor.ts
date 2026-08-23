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
	const handledImportedCoverUrl = ref("");
	const pendingCoverCrop = ref<{
		kind: "manual" | "imported";
		sourceFile?: File | null;
		sourceUrl?: string;
	} | null>(null);

	const unresolvedImportedCoverUrl = computed(() => {
		const next =
			albumImportDraft.value?.coverUrl?.trim() ||
			albumImportDraft.value?.derivedCover?.trim() ||
			"";
		return next && handledImportedCoverUrl.value !== next ? next : "";
	});
	const coverDisplayUrl = computed(
		() => coverPreviewUrl.value || albumDetailsDraft.value?.coverUrl || "",
	);

	function clearCoverPreviewUrl() {
		if (!coverPreviewUrl.value) return;
		URL.revokeObjectURL(coverPreviewUrl.value);
		coverPreviewUrl.value = "";
	}

	function queueImportedCoverCrop(sourceUrl: string) {
		const flow = creationFlow.value;
		if (!flow || !sourceUrl.trim()) return;
		if (flow.draft.albumDetails.coverUrl === sourceUrl) {
			flow.draft.albumDetails.coverUrl = "";
			flow.draft.albumDetails.coverAsset = null;
		}
		pendingCoverCrop.value = { kind: "imported", sourceUrl };
	}

	function reopenImportedCoverCrop() {
		if (unresolvedImportedCoverUrl.value)
			queueImportedCoverCrop(unresolvedImportedCoverUrl.value);
	}

	async function confirmCoverCrop(file: File) {
		const flow = creationFlow.value;
		const draft = albumDetailsDraft.value;
		if (!flow || !draft) return;
		const importedSourceUrl =
			pendingCoverCrop.value?.kind === "imported"
				? pendingCoverCrop.value.sourceUrl?.trim() || ""
				: "";

		clearCoverPreviewUrl();
		coverPreviewUrl.value = URL.createObjectURL(file);
		coverUploading.value = true;
		coverErrorMessage.value = "";
		flow.assetUploading = true;
		if (importedSourceUrl) handledImportedCoverUrl.value = importedSourceUrl;
		pendingCoverCrop.value = null;

		try {
			const asset = await uploadMusicAsset(file, "music.cover");
			draft.coverAsset = asset;
			draft.coverUrl = asset.url;
			clearCoverPreviewUrl();
		} catch (error) {
			coverErrorMessage.value =
				error instanceof Error ? error.message : "封面上传失败";
		} finally {
			coverUploading.value = false;
			flow.assetUploading = false;
		}
	}

	function onCoverChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) pendingCoverCrop.value = { kind: "manual", sourceFile: file };
		input.value = "";
	}

	watch(
		unresolvedImportedCoverUrl,
		(nextCoverUrl) => {
			if (
				!creationFlow.value ||
				!nextCoverUrl ||
				albumDetailsDraft.value?.coverUrl.trim()
			)
				return;
			if (
				pendingCoverCrop.value?.kind === "manual" ||
				handledImportedCoverUrl.value === nextCoverUrl
			)
				return;
			if (
				pendingCoverCrop.value?.kind === "imported" &&
				pendingCoverCrop.value.sourceUrl?.trim() === nextCoverUrl
			)
				return;
			queueImportedCoverCrop(nextCoverUrl);
		},
		{ immediate: true },
	);

	onBeforeUnmount(clearCoverPreviewUrl);

	return {
		coverInputRef,
		coverUploading,
		coverErrorMessage,
		coverDisplayUrl,
		pendingCoverCrop,
		unresolvedImportedCoverUrl,
		onCoverChange,
		reopenImportedCoverCrop,
		confirmCoverCrop,
		clearPendingCoverCrop: () => {
			pendingCoverCrop.value = null;
		},
	};
}
