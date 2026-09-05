import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useSheetNavigation } from "../../../src/composables/useSheetNavigation";

describe("useSheetNavigation", () => {
	it("exposes adjacent items and navigates in list order", async () => {
		const currentId = ref("item-2");
		const onNavigate = vi.fn((id: string) => {
			currentId.value = id;
		});
		const navigation = useSheetNavigation(
			currentId,
			async () => [
				{ id: "item-1", label: "第一项" },
				{ id: "item-2", label: "第二项" },
				{ id: "item-3", label: "第三项" },
			],
			onNavigate,
		);

		await nextTick();
		await vi.waitFor(() => expect(navigation.navigation.value.next?.id).toBe("item-3"));
		expect(navigation.navigation.value.previous?.label).toBe("第一项");

		navigation.navigate("next");
		expect(onNavigate).toHaveBeenCalledWith("item-3");
		expect(navigation.direction.value).toBe("next");

		await nextTick();
		expect(navigation.navigation.value.next).toBeNull();
		expect(navigation.navigation.value.previous?.id).toBe("item-2");
	});

	it("ignores a stale list response after the current item changes", async () => {
		const currentId = ref("item-1");
		const resolvers: Array<(items: Array<{ id: string; label: string }>) => void> = [];
		const loadItems = vi.fn(() => new Promise<Array<{ id: string; label: string }>>((resolve) => {
			resolvers.push(resolve);
		}));
		const navigation = useSheetNavigation(currentId, loadItems, vi.fn());

		currentId.value = "item-2";
		await nextTick();
		resolvers[0]?.([
			{ id: "item-1", label: "旧列表" },
		]);
		resolvers[1]?.([{ id: "item-2", label: "当前项" }]);
		await vi.waitFor(() => expect(loadItems).toHaveBeenCalledTimes(2));
		expect(navigation.navigation.value.previous).toBeNull();
	});

	it("does not load navigation items while the sheet is not topmost", async () => {
		const currentId = ref("item-2");
		const enabled = ref(false);
		const loadItems = vi.fn(async () => [
			{ id: "item-1", label: "第一项" },
			{ id: "item-2", label: "第二项" },
		]);
		const navigation = useSheetNavigation(currentId, loadItems, vi.fn(), enabled);

		await nextTick();
		expect(loadItems).not.toHaveBeenCalled();
		expect(navigation.navigation.value.previous).toBeNull();

		enabled.value = true;
		await vi.waitFor(() => expect(loadItems).toHaveBeenCalledTimes(1));
		expect(navigation.navigation.value.previous?.id).toBe("item-1");
	});
});
