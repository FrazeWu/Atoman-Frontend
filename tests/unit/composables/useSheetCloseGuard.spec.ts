import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useSheetCloseGuard } from "../../../src/composables/useSheetCloseGuard";

describe("useSheetCloseGuard", () => {
	it("closes an unchanged sheet immediately", () => {
		const dirty = ref(false);
		const submitting = ref(false);
		const close = vi.fn();
		const guard = useSheetCloseGuard({
			isDirty: computed(() => dirty.value),
			isSubmitting: submitting,
			close,
		});

		guard.requestClose();

		expect(close).toHaveBeenCalledOnce();
		expect(guard.discardPending.value).toBe(false);
	});

	it("requires confirmation before discarding changes", () => {
		const dirty = ref(true);
		const submitting = ref(false);
		const close = vi.fn();
		const guard = useSheetCloseGuard({
			isDirty: computed(() => dirty.value),
			isSubmitting: submitting,
			close,
		});

		guard.requestClose();
		expect(guard.discardPending.value).toBe(true);
		expect(close).not.toHaveBeenCalled();

		guard.cancelDiscard();
		expect(guard.discardPending.value).toBe(false);
		guard.requestClose();
		guard.confirmDiscard();
		expect(close).toHaveBeenCalledOnce();
	});

	it("does not close or dismiss the confirmation while submitting", () => {
		const dirty = ref(true);
		const submitting = ref(true);
		const close = vi.fn();
		const guard = useSheetCloseGuard({
			isDirty: computed(() => dirty.value),
			isSubmitting: submitting,
			close,
		});

		guard.requestClose();
		expect(guard.discardPending.value).toBe(false);

		submitting.value = false;
		guard.requestClose();
		submitting.value = true;
		guard.confirmDiscard();
		guard.cancelDiscard();

		expect(guard.discardPending.value).toBe(true);
		expect(close).not.toHaveBeenCalled();
	});
});
