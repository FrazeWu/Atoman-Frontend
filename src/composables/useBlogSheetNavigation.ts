import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { apiRequestResult } from "@/api/client";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
	useSheetNavigation,
	type SheetNavigationItem,
	type SheetNavigationDirection,
} from "@/composables/useSheetNavigation";

export type BlogNavigableKind = "post" | "short_note" | "channel" | "collection";

function listPayload(payload: unknown): unknown[] {
	if (Array.isArray(payload)) return payload;
	if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
		return (payload as { data: unknown[] }).data;
	}
	return [];
}

export function useBlogSheetNavigation(
	kind: BlogNavigableKind,
	currentId: MaybeRefOrGetter<string | null | undefined>,
	onNavigate: (id: string) => void,
	enabled: MaybeRefOrGetter<boolean> = true,
) {
	const api = useApi();
	const authStore = useAuthStore();
	const loadItems = async (): Promise<SheetNavigationItem[]> => {
		const params = new URLSearchParams({ page: "1", page_size: "100" });
		let url = api.blog.posts;
		if (kind === "short_note") url = api.blog.shortNotes;
		if (kind === "channel") url = api.blog.channels;
		if (kind === "collection") url = api.blog.collections;
		if (kind === "post") params.set("status", "published");
		url += `?${params.toString()}`;

		const response = await apiRequestResult(url, {
			headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
		});
		if (!response.ok) return [];
		return listPayload(response.data).flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const value = item as Record<string, unknown>;
			const id = String(value.id || "");
			const label = String(value.title || value.name || value.content || "").trim();
			return id && label ? [{ id, label: label.slice(0, 80) }] : [];
		});
	};

	return useSheetNavigation(
		computed(() => toValue(currentId) || ""),
		loadItems,
		onNavigate,
		enabled,
	);
}

export type { SheetNavigationDirection };
