import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

export interface SheetNavigationItem {
	id: string;
	label: string;
}

export type SheetNavigationDirection = "previous" | "next";

export function useSheetNavigation(
	currentId: MaybeRefOrGetter<string | null | undefined>,
	loadItems: () => Promise<SheetNavigationItem[]>,
	onNavigate: (id: string) => void,
	enabled: MaybeRefOrGetter<boolean> = true,
) {
	const current = computed(() => toValue(currentId) || "");
	const isEnabled = computed(() => toValue(enabled));
	const items = ref<SheetNavigationItem[]>([]);
	const loading = ref(false);
	const direction = ref<SheetNavigationDirection>("next");
	let requestSequence = 0;

	const navigation = computed(() => {
		const index = items.value.findIndex((item) => item.id === current.value);
		if (index < 0) return { previous: null, next: null };
		return {
			previous: items.value[index - 1] ?? null,
			next: items.value[index + 1] ?? null,
		};
	});

	const load = async () => {
		if (!isEnabled.value) {
			requestSequence += 1;
			items.value = [];
			loading.value = false;
			return;
		}
		const requestedId = current.value;
		const sequence = ++requestSequence;
		items.value = [];
		if (!requestedId) {
			loading.value = false;
			return;
		}

		loading.value = true;
		try {
			const loadedItems = await loadItems();
			if (sequence !== requestSequence || requestedId !== current.value) return;
			items.value = loadedItems.filter((item) => item.id && item.label);
		} catch {
			if (sequence === requestSequence) items.value = [];
		} finally {
			if (sequence === requestSequence) loading.value = false;
		}
	};

	const navigate = (nextDirection: SheetNavigationDirection) => {
		const target = navigation.value[nextDirection];
		if (!target || loading.value) return false;
		direction.value = nextDirection;
		onNavigate(target.id);
		return true;
	};

	watch([current, isEnabled], () => void load(), { immediate: true });

	return {
		navigation,
		loading,
		direction,
		load,
		navigate,
	};
}
