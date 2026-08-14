import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
	type ComputedRef,
	type Ref,
} from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { apiRequestResult } from "@/api/client";
import { useApi } from "@/composables/useApi";
import { useAutoSave } from "@/composables/useAutoSave";
import { useAuthStore } from "@/stores/auth";
import type { BlogDraft, Collection } from "@/types";
import { reportError } from "@/utils/logger";

export type SaveTarget = "draft" | "published";
export type BlogVisibility = "public" | "followers" | "private";
export type PostEditorContentSource = "empty" | "imported" | "manual";

export interface PostEditorDraftForm {
	title: string;
	content: string;
	summary: string;
	cover_url: string;
	visibility: BlogVisibility;
}

export interface EditorDraftPayload extends PostEditorDraftForm {
	context_key: string;
	source_post_id?: string;
	channel_id?: string;
	collection_ids: string[];
}

type DraftSyncState = "idle" | "syncing" | "synced" | "error";
type EditorSessionState =
	| "awaiting-collab"
	| "collab-conflict"
	| "collab-active"
	| "local-edit";
type DraftCandidate = {
	source: "local" | "server";
	payload: EditorDraftPayload;
	savedAt: number;
};
type DraftStatus = { text: string; tone: "ok" | "warn" | "muted" };

interface PostEditorDraftSessionOptions {
	isEdit: ComputedRef<boolean>;
	draftContextKey: ComputedRef<string>;
	draftPayload: ComputedRef<EditorDraftPayload>;
	form: Ref<PostEditorDraftForm>;
	contentSource: Ref<PostEditorContentSource>;
	channelCollections: Ref<Collection[]>;
	selectedCollectionIds: Ref<string[]>;
	loadedPostUpdatedAt: Ref<number>;
	contentReady: Ref<boolean>;
	saving: Ref<SaveTarget | null>;
	ensureDefaultSelection: () => void;
	getReplaceEditorDocument: () => (markdown: string) => void;
}

export const parseDraftTimestamp = (value?: string | null) => {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

export function usePostEditorDraftSession({
	isEdit,
	draftContextKey,
	draftPayload,
	form,
	contentSource,
	channelCollections,
	selectedCollectionIds,
	loadedPostUpdatedAt,
	contentReady,
	saving,
	ensureDefaultSelection,
	getReplaceEditorDocument,
}: PostEditorDraftSessionOptions) {
	const api = useApi();
	const authStore = useAuthStore();
	const router = useRouter();

	const recoveryModalVisible = ref(false);
	const pendingDraftCandidate = ref<DraftCandidate | null>(null);
	const deferredDraftCandidate = ref<DraftCandidate | null>(null);
	const draftManagerVisible = ref(false);
	const leaveConfirmVisible = ref(false);
	const serverDraftState = ref<DraftSyncState>("idle");
	const serverDraftSavedAt = ref<number | null>(null);
	const draftWatchEnabled = ref(false);
	const isApplyingDraft = ref(false);
	const pendingLeavePath = ref<string | null>(null);
	const allowRouteLeaveOnce = ref(false);
	const editorSessionState = ref<EditorSessionState>(
		isEdit.value ? "awaiting-collab" : "local-edit",
	);
	const collabStartupFallbackTriggered = ref(false);

	let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
	let collabStartupTimer: ReturnType<typeof setTimeout> | null = null;

	const hasMeaningfulDraft = (payload: EditorDraftPayload) =>
		Boolean(
			payload.title.trim() ||
				payload.content.trim() ||
				payload.summary.trim() ||
				payload.cover_url.trim() ||
				payload.channel_id ||
				payload.collection_ids.length,
		);

	const {
		autoSaveState,
		lastSavedAt,
		triggerAutoSave,
		loadDraft,
		clearDraft: clearLocalDraft,
	} = useAutoSave<EditorDraftPayload>({
		getDraftKey: () => `blog_editor_${draftContextKey.value}`,
		getPayload: () => draftPayload.value,
		shouldPersist: hasMeaningfulDraft,
	});

	const formatSavedTime = (value?: number | null) => {
		if (!value) return "--:--";
		return new Date(value).toLocaleTimeString("zh-CN", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const isCollabConflict = computed(
		() => editorSessionState.value === "collab-conflict",
	);
	const draftStatus = computed<DraftStatus>(() => {
		if (saving.value === "published") return { tone: "warn", text: "发布中…" };
		if (saving.value === "draft") return { tone: "warn", text: "草稿保存中…" };
		if (serverDraftState.value === "error") {
			return { tone: "warn", text: "云端草稿同步失败，当前仅保存在本地" };
		}
		if (autoSaveState.value === "error") {
			return {
				tone: "warn",
				text: "本地草稿保存失败，请手动保存或检查浏览器存储权限",
			};
		}
		if (
			autoSaveState.value === "saving" ||
			serverDraftState.value === "syncing"
		) {
			return { tone: "warn", text: "草稿同步中…" };
		}
		if (deferredDraftCandidate.value)
			return { tone: "warn", text: "检测到可恢复草稿" };
		if (lastSavedAt.value || serverDraftSavedAt.value) {
			const labels = [];
			if (lastSavedAt.value)
				labels.push(`本地 ${formatSavedTime(lastSavedAt.value)}`);
			if (serverDraftSavedAt.value)
				labels.push(`云端 ${formatSavedTime(serverDraftSavedAt.value)}`);
			return { tone: "ok", text: `草稿已保存 · ${labels.join(" · ")}` };
		}
		return { tone: "muted", text: "开始写作后会自动保存草稿" };
	});

	const draftPreview = (candidate: DraftCandidate | null) => {
		if (!candidate) return "";
		const sourceText = candidate.payload.summary || candidate.payload.content;
		const plainText = sourceText
			.replace(/[#*_>`~\-[\]()]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return plainText || "这份草稿还没有正文预览。";
	};
	const draftRecoveryPreview = computed(() =>
		draftPreview(pendingDraftCandidate.value),
	);
	const deferredDraftSummary = computed(() =>
		draftPreview(deferredDraftCandidate.value),
	);
	const hasDraftManagerAccess = computed(
		() =>
			!!deferredDraftCandidate.value ||
			!!lastSavedAt.value ||
			!!serverDraftSavedAt.value ||
			hasMeaningfulDraft(draftPayload.value) ||
			serverDraftState.value === "error",
	);
	const localDraftStatusText = computed(() => {
		if (lastSavedAt.value)
			return `最近保存于 ${formatSavedTime(lastSavedAt.value)}`;
		if (autoSaveState.value === "saving") return "正在保存中…";
		if (autoSaveState.value === "error") return "本地草稿保存失败";
		if (hasMeaningfulDraft(draftPayload.value))
			return "已有编辑内容，等待下一次自动保存";
		return "暂无本地草稿";
	});
	const cloudDraftStatusText = computed(() => {
		if (!authStore.token) return "未登录，未启用云端草稿";
		if (serverDraftState.value === "syncing") return "正在同步到云端…";
		if (serverDraftState.value === "error") return "同步失败，等待手动重试";
		if (serverDraftSavedAt.value)
			return `最近同步于 ${formatSavedTime(serverDraftSavedAt.value)}`;
		if (hasMeaningfulDraft(draftPayload.value)) return "尚未生成云端草稿";
		return "暂无云端草稿";
	});
	const leaveConfirmText = computed(() => {
		if (saving.value === "published")
			return "文章正在发布中，离开后可能无法确认本次发布结果。";
		if (saving.value === "draft")
			return "文章正在保存草稿，离开后本次保存可能无法完成。";
		if (serverDraftState.value === "syncing") {
			return "云端草稿仍在同步中，离开后最新改动可能只保留在本地。";
		}
		return "本地草稿仍在写入中，离开后最新改动可能不会进入已保存草稿。";
	});
	const hasPendingPersistence = computed(
		() =>
			autoSaveState.value === "saving" ||
			serverDraftState.value === "syncing" ||
			!!saving.value,
	);
	const recoveryModalTitle = computed(() =>
		isCollabConflict.value ? "协作文档与草稿冲突" : "发现未恢复草稿",
	);
	const recoveryModalLabel = computed(() => {
		if (isCollabConflict.value) {
			return pendingDraftCandidate.value?.source === "server"
				? "云端草稿待恢复"
				: "本地草稿待恢复";
		}
		return pendingDraftCandidate.value?.source === "server"
			? "云端草稿"
			: "本地草稿";
	});
	const recoveryModalText = computed(() => {
		if (!pendingDraftCandidate.value) return "";
		const sourceText =
			pendingDraftCandidate.value.source === "server" ? "云端" : "本地";
		if (isCollabConflict.value) {
			return `协作文档与草稿内容不一致。检测到一份较新的${sourceText}草稿，保存于 ${formatSavedTime(pendingDraftCandidate.value.savedAt)}。请选择保留协作文档，或恢复草稿后覆盖共享文档。`;
		}
		return `检测到一份较新的${sourceText}草稿，保存于 ${formatSavedTime(pendingDraftCandidate.value.savedAt)}。恢复后会覆盖当前编辑区内容。`;
	});
	const keepCurrentContentLabel = computed(() =>
		isCollabConflict.value ? "保留协作文档" : "稍后处理",
	);

	const clearServerSyncTimer = () => {
		if (!serverSyncTimer) return;
		clearTimeout(serverSyncTimer);
		serverSyncTimer = null;
	};
	const clearCollabStartupTimer = () => {
		if (!collabStartupTimer) return;
		clearTimeout(collabStartupTimer);
		collabStartupTimer = null;
	};
	const authHeaders = (): Record<string, string> =>
		authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {};

	const blogDraftToPayload = (draft: BlogDraft): EditorDraftPayload => ({
		context_key: draft.context_key,
		source_post_id: draft.source_post_id,
		title: draft.title || "",
		content: draft.content || "",
		summary: draft.summary || "",
		cover_url: draft.cover_url || "",
		visibility: draft.visibility || "public",
		channel_id: draft.channel_id,
		collection_ids: draft.collection_ids || [],
	});
	const setPendingDraftCandidate = (candidate: DraftCandidate | null) => {
		pendingDraftCandidate.value = candidate;
		deferredDraftCandidate.value = candidate;
	};
	const fetchServerDraft = async () => {
		if (!authStore.token) return null;
		try {
			const res = await apiRequestResult(
				`${api.blog.draft}?context_key=${encodeURIComponent(draftContextKey.value)}`,
				{
					headers: authHeaders(),
				},
			);
			if (!res.ok) return null;
			const data = res.data;
			return (data.data || null) as BlogDraft | null;
		} catch (error) {
			reportError(error, "Failed to fetch blog draft:");
			return null;
		}
	};
	const getLatestDraftCandidate = async () => {
		const localDraft = loadDraft();
		const serverDraft = await fetchServerDraft();
		const candidates: DraftCandidate[] = [];
		if (localDraft && hasMeaningfulDraft(localDraft.payload)) {
			lastSavedAt.value = localDraft.saved_at;
			candidates.push({
				source: "local",
				payload: localDraft.payload,
				savedAt: localDraft.saved_at,
			});
		}
		if (serverDraft) {
			const payload = blogDraftToPayload(serverDraft);
			if (hasMeaningfulDraft(payload)) {
				const savedAt = parseDraftTimestamp(serverDraft.updated_at);
				serverDraftSavedAt.value = savedAt || serverDraftSavedAt.value;
				candidates.push({ source: "server", payload, savedAt });
			}
		}
		candidates.sort((left, right) => right.savedAt - left.savedAt);
		return candidates[0] ?? null;
	};

	const finalizeCollabStartup = () => {
		clearCollabStartupTimer();
		editorSessionState.value = "collab-active";
		recoveryModalVisible.value = false;
		pendingDraftCandidate.value = null;
	};
	const deleteServerDraft = async () => {
		clearServerSyncTimer();
		serverDraftState.value = "idle";
		serverDraftSavedAt.value = null;
		if (!authStore.token) return;
		try {
			await apiRequestResult(
				`${api.blog.draft}?context_key=${encodeURIComponent(draftContextKey.value)}`,
				{
					method: "DELETE",
					headers: authHeaders(),
				},
			);
		} catch (error) {
			reportError(error, "Failed to delete blog draft:");
		}
	};
	const syncServerDraft = async () => {
		if (!authStore.token || !draftWatchEnabled.value) return;
		const payload = draftPayload.value;
		if (!hasMeaningfulDraft(payload)) {
			await deleteServerDraft();
			return;
		}

		serverDraftState.value = "syncing";
		try {
			const res = await apiRequestResult(api.blog.draft, {
				method: "PUT",
				headers: { "Content-Type": "application/json", ...authHeaders() },
				body: JSON.stringify(payload),
			});
			if (!res.ok) throw new Error("Failed to sync draft");
			const data = res.data;
			const draft = (data.data || null) as BlogDraft | null;
			serverDraftSavedAt.value = draft
				? parseDraftTimestamp(draft.updated_at)
				: Date.now();
			serverDraftState.value = "synced";
		} catch (error) {
			reportError(error, "Failed to sync blog draft:");
			serverDraftState.value = "error";
		}
	};
	const scheduleServerDraftSync = () => {
		clearServerSyncTimer();
		if (!authStore.token || !draftWatchEnabled.value || isApplyingDraft.value)
			return;
		serverSyncTimer = setTimeout(() => {
			void syncServerDraft();
		}, 1800);
	};
	const clearAllDrafts = async () => {
		clearLocalDraft();
		await deleteServerDraft();
		pendingDraftCandidate.value = null;
		deferredDraftCandidate.value = null;
		recoveryModalVisible.value = false;
	};

	const applyDraftPayload = async (payload: EditorDraftPayload) => {
		isApplyingDraft.value = true;
		try {
			form.value = {
				title: payload.title,
				content: payload.content,
				summary: payload.summary,
				cover_url: payload.cover_url,
				visibility: payload.visibility,
			};
			contentSource.value = hasMeaningfulDraft(payload) ? "manual" : "empty";
			const allowed = new Set(
				channelCollections.value.map((collection) => collection.id),
			);
			selectedCollectionIds.value = payload.collection_ids.filter(
				(collectionId) => allowed.has(collectionId),
			);
			if (!selectedCollectionIds.value.length) ensureDefaultSelection();
			await nextTick();
		} finally {
			isApplyingDraft.value = false;
		}
	};
	const evaluateDraftRecovery = async () => {
		const latestCandidate = await getLatestDraftCandidate();
		if (!latestCandidate) return;
		if (isEdit.value && latestCandidate.savedAt <= loadedPostUpdatedAt.value)
			return;
		setPendingDraftCandidate(latestCandidate);
		recoveryModalVisible.value = true;
	};
	const fallbackCollabRecovery = async () => {
		if (
			!isEdit.value ||
			collabStartupFallbackTriggered.value ||
			editorSessionState.value !== "awaiting-collab"
		)
			return;
		collabStartupFallbackTriggered.value = true;
		clearCollabStartupTimer();
		await evaluateDraftRecovery();
		if (!recoveryModalVisible.value) editorSessionState.value = "local-edit";
	};

	const parseEditorMarkdown = (markdown: string) => {
		const normalized = markdown || "";
		const newline = normalized.indexOf("\n");
		const firstLine = newline >= 0 ? normalized.slice(0, newline) : normalized;
		return {
			title: firstLine.replace(/^#+\s*/, "").trim(),
			content: newline >= 0 ? normalized.slice(newline + 1) : "",
		};
	};
	const hasMeaningfulMarkdown = (markdown: string) => {
		const { title, content } = parseEditorMarkdown(markdown);
		return Boolean(title.trim() || content.trim());
	};
	const normalizeEditorText = (value: string) =>
		value.replace(/\r\n/g, "\n").trim();
	const isEquivalentEditorContent = (
		left: Pick<EditorDraftPayload, "title" | "content">,
		right: Pick<EditorDraftPayload, "title" | "content">,
	) =>
		normalizeEditorText(left.title) === normalizeEditorText(right.title) &&
		normalizeEditorText(left.content) === normalizeEditorText(right.content);
	const applyEditorMarkdown = async (markdown: string) => {
		const { title, content } = parseEditorMarkdown(markdown);
		form.value.title = title;
		form.value.content = content;
		contentSource.value = hasMeaningfulMarkdown(markdown) ? "manual" : "empty";
		await nextTick();
	};

	const keepCurrentContent = () => {
		recoveryModalVisible.value = false;
		pendingDraftCandidate.value = null;
		if (isCollabConflict.value) finalizeCollabStartup();
	};
	const openDraftManager = () => {
		draftManagerVisible.value = true;
	};
	const closeDraftManager = () => {
		draftManagerVisible.value = false;
	};
	const restorePendingDraft = async () => {
		const candidate = pendingDraftCandidate.value;
		if (!candidate) return;
		if (isCollabConflict.value) {
			const replaceDocument = getReplaceEditorDocument();
			await applyDraftPayload(candidate.payload);
			replaceDocument(
				`# ${candidate.payload.title}\n${candidate.payload.content}`,
			);
			deferredDraftCandidate.value = null;
			finalizeCollabStartup();
			return;
		}

		recoveryModalVisible.value = false;
		deferredDraftCandidate.value = null;
		pendingDraftCandidate.value = null;
		await applyDraftPayload(candidate.payload);
	};
	const discardPendingDraft = () => clearAllDrafts();
	const restoreDeferredFromManager = async () => {
		if (!deferredDraftCandidate.value) return;
		pendingDraftCandidate.value = deferredDraftCandidate.value;
		draftManagerVisible.value = false;
		await restorePendingDraft();
	};
	const syncDraftNow = async () => {
		clearServerSyncTimer();
		await syncServerDraft();
	};
	const handleCollabReady = async (markdown: string) => {
		if (!isEdit.value) return;
		clearCollabStartupTimer();
		editorSessionState.value = "awaiting-collab";
		await applyEditorMarkdown(markdown);

		const latestCandidate = await getLatestDraftCandidate();
		if (!latestCandidate) {
			finalizeCollabStartup();
			return;
		}
		const draftMarkdown = `# ${latestCandidate.payload.title}\n${latestCandidate.payload.content}`;
		if (
			hasMeaningfulMarkdown(markdown) &&
			hasMeaningfulDraft(latestCandidate.payload) &&
			!isEquivalentEditorContent(
				parseEditorMarkdown(markdown),
				latestCandidate.payload,
			)
		) {
			setPendingDraftCandidate(latestCandidate);
			editorSessionState.value = "collab-conflict";
			recoveryModalVisible.value = true;
			return;
		}
		if (
			!hasMeaningfulMarkdown(markdown) &&
			hasMeaningfulDraft(latestCandidate.payload)
		) {
			await applyDraftPayload(latestCandidate.payload);
			getReplaceEditorDocument()(draftMarkdown);
		}
		deferredDraftCandidate.value = null;
		finalizeCollabStartup();
	};
	const clearSavedDrafts = async () => {
		await clearAllDrafts();
		draftManagerVisible.value = false;
	};

	const cancelLeave = () => {
		leaveConfirmVisible.value = false;
		pendingLeavePath.value = null;
	};
	const allowNextRouteLeave = () => {
		allowRouteLeaveOnce.value = true;
	};
	const confirmLeave = async () => {
		const targetPath = pendingLeavePath.value;
		leaveConfirmVisible.value = false;
		pendingLeavePath.value = null;
		if (!targetPath) return;
		allowNextRouteLeave();
		await router.push(targetPath);
	};
	const handleBeforeUnload = (event: BeforeUnloadEvent) => {
		if (!hasPendingPersistence.value) return;
		event.preventDefault();
		event.returnValue = "";
	};
	const startDraftSession = async () => {
		draftWatchEnabled.value = true;
		if (isEdit.value) {
			editorSessionState.value = "awaiting-collab";
			collabStartupFallbackTriggered.value = false;
			clearCollabStartupTimer();
			collabStartupTimer = setTimeout(() => {
				void fallbackCollabRecovery();
			}, 1500);
			return;
		}
		await evaluateDraftRecovery();
	};

	watch(
		() => JSON.stringify(draftPayload.value),
		() => {
			if (
				!draftWatchEnabled.value ||
				isApplyingDraft.value ||
				!contentReady.value
			)
				return;
			if (
				contentSource.value === "empty" &&
				hasMeaningfulDraft(draftPayload.value)
			) {
				contentSource.value = "manual";
			}
			triggerAutoSave();
			scheduleServerDraftSync();
		},
	);
	onBeforeRouteLeave((to) => {
		if (allowRouteLeaveOnce.value) {
			allowRouteLeaveOnce.value = false;
			return true;
		}
		if (!hasPendingPersistence.value) return true;
		pendingLeavePath.value = to.fullPath;
		leaveConfirmVisible.value = true;
		return false;
	});
	onMounted(() => window.addEventListener("beforeunload", handleBeforeUnload));
	onBeforeUnmount(() => {
		window.removeEventListener("beforeunload", handleBeforeUnload);
		clearServerSyncTimer();
		clearCollabStartupTimer();
	});

	return {
		recoveryModalVisible,
		pendingDraftCandidate,
		deferredDraftCandidate,
		draftManagerVisible,
		leaveConfirmVisible,
		serverDraftState,
		draftStatus,
		draftRecoveryPreview,
		deferredDraftSummary,
		hasDraftManagerAccess,
		localDraftStatusText,
		cloudDraftStatusText,
		leaveConfirmText,
		isCollabConflict,
		recoveryModalTitle,
		recoveryModalLabel,
		recoveryModalText,
		keepCurrentContentLabel,
		hasMeaningfulDraft,
		formatSavedTime,
		keepCurrentContent,
		openDraftManager,
		closeDraftManager,
		restorePendingDraft,
		discardPendingDraft,
		restoreDeferredFromManager,
		syncDraftNow,
		handleCollabReady,
		clearSavedDrafts,
		cancelLeave,
		confirmLeave,
		clearAllDrafts,
		allowNextRouteLeave,
		startDraftSession,
	};
}
