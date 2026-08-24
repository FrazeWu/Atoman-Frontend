import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";

import {
	apiDeleteJson,
	apiGet,
	apiGetEnvelope,
	apiPatchJson,
	apiPostJson,
	apiPutJson,
} from "@/api/client";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import type {
	StudioAnalytics,
	StudioChannel,
	StudioCollection,
	StudioCollectionContentItem,
	StudioCollectionInput,
	StudioContentFilters,
	StudioContentItem,
	StudioDashboard,
	StudioInteractionFilters,
	StudioInteractionItem,
	StudioModule,
	StudioPagination,
	StudioSettings,
	StudioSettingsInput,
	StudioState,
} from "@/types";

function emptyModuleRecord<T>(factory: () => T): Record<StudioModule, T> {
	return {
		blog: factory(),
		podcast: factory(),
		video: factory(),
	};
}

function appendQuery(
	url: string,
	values: Record<string, string | number | boolean | undefined>,
) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined && value !== "") query.set(key, String(value));
	}
	const encoded = query.toString();
	return encoded ? `${url}?${encoded}` : url;
}

export const useStudioStore = defineStore("studio", () => {
	const endpoints = useApi();
	const api = endpoints.studio;
	const auth = useAuthStore();

	const currentChannel = ref<StudioChannel | null>(null);
	const channels = ref<StudioChannel[]>([]);
	const loaded = ref(false);
	const loading = ref(false);
	const dashboard = ref<StudioDashboard | null>(null);
	const contents = ref(emptyModuleRecord<StudioContentItem[]>(() => []));
	const contentPagination = ref(
		emptyModuleRecord<StudioPagination | null>(() => null),
	);
	const collections = ref(emptyModuleRecord<StudioCollection[]>(() => []));
	const unifiedCollections = ref<StudioCollection[]>([]);
	const unifiedCollectionContents = ref<StudioCollectionContentItem[]>([]);
	const unifiedCollectionContentsCollectionID = ref("");
	const analytics = ref(emptyModuleRecord<StudioAnalytics | null>(() => null));
	const interactions = ref(
		emptyModuleRecord<StudioInteractionItem[]>(() => []),
	);
	const interactionPagination = ref(
		emptyModuleRecord<StudioPagination | null>(() => null),
	);
	const settings = ref(emptyModuleRecord<StudioSettings | null>(() => null));
	const error = ref("");

	let loadStatePromise: Promise<void> | null = null;
	let stateRequestVersion = 0;
	let activeReload: (() => Promise<void>) | null = null;
	let channelSelectionRequestVersion = 0;
	let dashboardRequestVersion = 0;
	let unifiedCollectionsRequestVersion = 0;
	let unifiedCollectionContentsRequestVersion = 0;
	const contentsRequestVersion = emptyModuleRecord(() => 0);
	const collectionsRequestVersion = emptyModuleRecord(() => 0);
	const analyticsRequestVersion = emptyModuleRecord(() => 0);
	const interactionsRequestVersion = emptyModuleRecord(() => 0);
	const settingsLoadRequestVersion = emptyModuleRecord(() => 0);
	const settingsSaveRequestVersion = emptyModuleRecord(() => 0);

	const hasChannel = computed(() => currentChannel.value !== null);

	function applyState(state: StudioState) {
		currentChannel.value = state.current_channel;
		channels.value = state.channels ?? [];
		loaded.value = true;
	}

	function clearResourceCaches() {
		dashboardRequestVersion += 1;
		unifiedCollectionsRequestVersion += 1;
		unifiedCollectionContentsRequestVersion += 1;
		for (const module of Object.keys(
			contentsRequestVersion,
		) as StudioModule[]) {
			contentsRequestVersion[module] += 1;
			collectionsRequestVersion[module] += 1;
			analyticsRequestVersion[module] += 1;
			interactionsRequestVersion[module] += 1;
			settingsLoadRequestVersion[module] += 1;
			settingsSaveRequestVersion[module] += 1;
		}
		dashboard.value = null;
		contents.value = emptyModuleRecord(() => []);
		contentPagination.value = emptyModuleRecord(() => null);
		collections.value = emptyModuleRecord(() => []);
		unifiedCollections.value = [];
		unifiedCollectionContents.value = [];
		unifiedCollectionContentsCollectionID.value = "";
		analytics.value = emptyModuleRecord(() => null);
		interactions.value = emptyModuleRecord(() => []);
		interactionPagination.value = emptyModuleRecord(() => null);
		settings.value = emptyModuleRecord(() => null);
		error.value = "";
	}

	function reset() {
		stateRequestVersion += 1;
		channelSelectionRequestVersion += 1;
		currentChannel.value = null;
		channels.value = [];
		loaded.value = false;
		loading.value = false;
		loadStatePromise = null;
		activeReload = null;
		clearResourceCaches();
	}

	function channelID() {
		if (!currentChannel.value?.id) throw new Error("请先创建或选择频道");
		return currentChannel.value.id;
	}

	async function loadState(force = false) {
		if (!auth.isAuthenticated || !auth.user) {
			reset();
			return;
		}
		if (!force && loaded.value) return;
		if (!force && loadStatePromise) return loadStatePromise;

		const requestVersion = ++stateRequestVersion;
		loading.value = true;
		error.value = "";
		let request: Promise<void>;
		request = apiGet<StudioState>(api.state)
			.then((state) => {
				if (stateRequestVersion === requestVersion) applyState(state);
			})
			.catch((cause) => {
				if (stateRequestVersion === requestVersion) {
					error.value =
						cause instanceof Error ? cause.message : "加载创作频道失败";
				}
				throw cause;
			})
			.finally(() => {
				if (
					stateRequestVersion !== requestVersion ||
					loadStatePromise !== request
				)
					return;
				loading.value = false;
				loadStatePromise = null;
			});
		loadStatePromise = request;
		return request;
	}

	async function selectChannel(selectedChannelID: string) {
		if (currentChannel.value?.id === selectedChannelID) return;
		const requestVersion = ++channelSelectionRequestVersion;
		const state = await apiPatchJson<StudioState>(api.state, {
			channel_id: selectedChannelID,
		});
		if (channelSelectionRequestVersion !== requestVersion) return;
		stateRequestVersion += 1;
		loading.value = false;
		loadStatePromise = null;
		applyState(state);
		clearResourceCaches();
		if (activeReload) await activeReload();
	}

	async function loadDashboard(track = true) {
		if (track) activeReload = () => loadDashboard(false);
		const requestVersion = ++dashboardRequestVersion;
		const requestChannelID = channelID();
		const response = await apiGet<StudioDashboard>(
			appendQuery(api.dashboard, { channel_id: requestChannelID }),
		);
		if (
			dashboardRequestVersion !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		dashboard.value = response;
	}

	async function loadContents(
		module: StudioModule,
		filters: StudioContentFilters,
		track = true,
	) {
		const snapshot = { ...filters };
		if (track) activeReload = () => loadContents(module, snapshot, false);
		const requestVersion = ++contentsRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiGetEnvelope<
			StudioContentItem[],
			StudioPagination
		>(
			appendQuery(api.contents(module), {
				channel_id: requestChannelID,
				q: filters.q.trim(),
				status: filters.status,
				visibility: filters.visibility,
				collection_id: filters.collection_id,
				issue: filters.issue,
				page: filters.page,
			}),
		);
		if (
			contentsRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		contents.value[module] = response.data ?? [];
		contentPagination.value[module] = response.meta ?? null;
	}

	async function loadUnifiedCollections(track = true) {
		if (track) activeReload = () => loadUnifiedCollections(false);
		const requestVersion = ++unifiedCollectionsRequestVersion;
		const requestChannelID = channelID();
		const response = await apiGet<StudioCollection[]>(
			appendQuery(api.unifiedCollections, { channel_id: requestChannelID }),
		);
		if (
			unifiedCollectionsRequestVersion !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		unifiedCollections.value = response;
	}

	async function loadUnifiedCollectionContents(collectionID: string, track = true) {
		if (track) {
			activeReload = async () => {
				await loadUnifiedCollections(false);
				if (unifiedCollections.value.some((collection) => collection.id === collectionID)) {
					await loadUnifiedCollectionContents(collectionID, false);
				}
			};
		}
		const requestVersion = ++unifiedCollectionContentsRequestVersion;
		const requestChannelID = channelID();
		const response = await apiGet<StudioCollectionContentItem[]>(
			api.unifiedCollectionContents(collectionID),
		);
		if (
			unifiedCollectionContentsRequestVersion !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		unifiedCollectionContents.value = response;
		unifiedCollectionContentsCollectionID.value = collectionID;
	}

	async function reorderUnifiedCollectionContents(
		collectionID: string,
		contentIDs: string[],
	) {
		await apiPutJson<{ reordered: boolean }>(
			api.reorderUnifiedCollectionContents(collectionID),
			{ content_ids: contentIDs },
		);
		await loadUnifiedCollectionContents(collectionID, false);
	}

	async function createUnifiedCollection(input: StudioCollectionInput) {
		await apiPostJson<StudioCollection>(api.unifiedCollections, {
			...input,
			channel_id: channelID(),
		});
		await loadUnifiedCollections(false);
	}

	async function updateUnifiedCollection(
		id: string,
		input: StudioCollectionInput,
	) {
		await apiPatchJson<StudioCollection>(api.unifiedCollection(id), input);
		await loadUnifiedCollections(false);
	}

	async function deleteUnifiedCollection(id: string) {
		await apiDeleteJson(api.unifiedCollection(id));
		await loadUnifiedCollections(false);
		if (unifiedCollectionContentsCollectionID.value === id) {
			unifiedCollectionContents.value = [];
			unifiedCollectionContentsCollectionID.value = "";
		}
	}

	async function loadCollections(module: StudioModule, track = true) {
		if (track) activeReload = () => loadCollections(module, false);
		const requestVersion = ++collectionsRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiGet<StudioCollection[]>(
			appendQuery(api.collections(module), { channel_id: requestChannelID }),
		);
		if (
			collectionsRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		collections.value[module] = response;
	}

	async function createCollection(
		module: StudioModule,
		input: StudioCollectionInput,
	) {
		await apiPostJson<StudioCollection>(api.collections(module), {
			...input,
			channel_id: channelID(),
		});
		await loadCollections(module, false);
	}

	async function updateCollection(
		module: StudioModule,
		id: string,
		input: StudioCollectionInput,
	) {
		await apiPatchJson<StudioCollection>(api.collection(module, id), input);
		await loadCollections(module, false);
	}

	async function deleteCollection(module: StudioModule, id: string) {
		await apiDeleteJson<{ message: string }>(api.collection(module, id));
		await loadCollections(module, false);
	}

	async function reorderCollectionContents(
		module: StudioModule,
		collectionID: string,
		contentIDs: string[],
	) {
		await apiPutJson<{ reordered: boolean }>(
			api.reorderCollectionContents(module, collectionID),
			{ content_ids: contentIDs },
		);
	}

	async function resolveCollectionConflict(
		module: StudioModule,
		contentID: string,
		collectionID: string,
	) {
		await apiPutJson<{ resolved: boolean }>(
			api.resolveCollectionConflict(module, contentID),
			{ collection_id: collectionID },
		);
	}

	async function resolveCollectionConflicts(
		module: StudioModule,
		items: Array<{ content_id: string; collection_id: string }>,
	) {
		await apiPutJson<{ resolved: boolean }>(
			api.resolveCollectionConflicts(module),
			{ items },
		);
	}

	async function loadAnalytics(
		module: StudioModule,
		range: 7 | 28 | 90,
		track = true,
	) {
		if (track) activeReload = () => loadAnalytics(module, range, false);
		const requestVersion = ++analyticsRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiGet<StudioAnalytics>(
			appendQuery(api.analytics(module), {
				channel_id: requestChannelID,
				range,
			}),
		);
		if (
			analyticsRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		analytics.value[module] = response;
	}

	async function loadInteractions(
		module: StudioModule,
		filters: StudioInteractionFilters,
		track = true,
	) {
		const snapshot = { ...filters };
		if (track) activeReload = () => loadInteractions(module, snapshot, false);
		const requestVersion = ++interactionsRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiGetEnvelope<
			StudioInteractionItem[],
			StudioPagination
		>(
			appendQuery(api.interactions(module), {
				channel_id: requestChannelID,
				unreplied: snapshot.unreplied,
				anchored: snapshot.anchored,
				page: snapshot.page,
			}),
		);
		if (
			interactionsRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		interactions.value[module] = response.data ?? [];
		interactionPagination.value[module] = response.meta ?? null;
	}

	async function loadSettings(module: StudioModule, track = true) {
		if (track) activeReload = () => loadSettings(module, false);
		const requestVersion = ++settingsLoadRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiGet<StudioSettings>(
			appendQuery(api.settings(module), { channel_id: requestChannelID }),
		);
		if (
			settingsLoadRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return;
		settings.value[module] = response;
	}

	async function saveSettings(
		module: StudioModule,
		input: StudioSettingsInput,
	) {
		const requestVersion = ++settingsSaveRequestVersion[module];
		const requestChannelID = channelID();
		const response = await apiPatchJson<StudioSettings>(api.settings(module), {
			...input,
			channel_id: requestChannelID,
		});
		if (
			settingsSaveRequestVersion[module] !== requestVersion ||
			currentChannel.value?.id !== requestChannelID
		)
			return false;
		settingsLoadRequestVersion[module] += 1;
		settings.value[module] = response;
		return true;
	}

	async function updateContentStatus(
		module: StudioModule,
		item: StudioContentItem,
		status: "draft" | "published",
	) {
		if (module === "blog") {
			const url =
				status === "published"
					? endpoints.blog.postPublish(item.id)
					: endpoints.blog.postUnpublish(item.id);
			await apiPostJson<unknown>(url, {});
			return;
		}
		const url =
			module === "podcast"
				? endpoints.podcast.episode(item.id)
				: endpoints.videos.update(item.id);
		await apiPutJson<unknown>(url, { status });
	}

	async function deleteContent(module: StudioModule, id: string) {
		const url =
			module === "blog"
				? endpoints.blog.post(id)
				: module === "podcast"
					? endpoints.podcast.episode(id)
					: endpoints.videos.delete(id);
		await apiDeleteJson<unknown>(url);
	}

	async function shareContent(module: StudioModule, id: string) {
		return apiPostJson<{ path: string }>(
			appendQuery(api.share(module, id), { channel_id: channelID() }),
			{},
		);
	}

	async function reprocessVideo(id: string) {
		await apiPostJson<unknown>(endpoints.videos.reprocess(id), {});
	}

	watch(
		() => auth.isAuthenticated,
		(isAuthenticated) => {
			if (!isAuthenticated) reset();
		},
	);

	return {
		currentChannel,
		channels,
		loaded,
		loading,
		hasChannel,
		dashboard,
		contents,
		contentPagination,
		collections,
		unifiedCollections,
		unifiedCollectionContents,
		unifiedCollectionContentsCollectionID,
		analytics,
		interactions,
		interactionPagination,
		settings,
		error,
		loadState,
		selectChannel,
		loadDashboard,
		loadContents,
		loadCollections,
		loadUnifiedCollections,
		loadUnifiedCollectionContents,
		reorderUnifiedCollectionContents,
		createUnifiedCollection,
		updateUnifiedCollection,
		deleteUnifiedCollection,
		createCollection,
		updateCollection,
		deleteCollection,
		reorderCollectionContents,
		resolveCollectionConflict,
		resolveCollectionConflicts,
		loadAnalytics,
		loadInteractions,
		loadSettings,
		saveSettings,
		updateContentStatus,
		deleteContent,
		shareContent,
		reprocessVideo,
		reset,
	};
});
