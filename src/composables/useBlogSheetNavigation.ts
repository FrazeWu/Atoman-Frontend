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

function listPayload(payload: unknown): { items: unknown[]; hasMore: boolean } {
	if (Array.isArray(payload)) return { items: payload, hasMore: false };
	if (payload && typeof payload === "object") {
		const value = payload as {
			data?: unknown;
			meta?: { has_more?: unknown };
		};
		if (Array.isArray(value.data)) {
			return { items: value.data, hasMore: value.meta?.has_more === true };
		}
	}
	return { items: [], hasMore: false };
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
		let url = api.blog.posts;
		if (kind === "short_note") url = api.blog.shortNotes;
		if (kind === "channel") url = api.blog.channels;
		if (kind === "collection") url = api.blog.collections;
		const items: SheetNavigationItem[] = [];
		const requestedId = toValue(currentId) || "";
		let page = 1;

		while (true) {
			const params = new URLSearchParams({ page: String(page), page_size: "100" });
			if (kind === "post") params.set("status", "published");
			const response = await apiRequestResult(`${url}?${params.toString()}`, {
				headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
			});
			if (!response.ok) return [];
			const pagePayload = listPayload(response.data);
			items.push(...pagePayload.items.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const value = item as Record<string, unknown>;
				const id = String(value.id || "");
				const label = String(value.title || value.name || value.content || "").trim();
				return id && label ? [{ id, label: label.slice(0, 80) }] : [];
			}));

			const currentIndex = items.findIndex((item) => item.id === requestedId);
			if (!pagePayload.hasMore || pagePayload.items.length === 0 || (currentIndex >= 0 && currentIndex < items.length - 1)) {
				return items;
			}
			page += 1;
		}
	};

	return useSheetNavigation(
		computed(() => toValue(currentId) || ""),
		loadItems,
		onNavigate,
		enabled,
	);
}

export type { SheetNavigationDirection };
