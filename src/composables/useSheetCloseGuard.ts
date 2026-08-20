import { computed, ref, type ComputedRef, type Ref } from "vue";

interface SheetCloseGuardOptions {
	isDirty: ComputedRef<boolean>;
	isSubmitting: Ref<boolean>;
	close: () => void;
}

/** Guards local form sheets from discarding changes or interrupting a submission. */
export function useSheetCloseGuard({
	isDirty,
	isSubmitting,
	close,
}: SheetCloseGuardOptions) {
	const discardPending = ref(false);

	const canClose = computed(() => !isSubmitting.value);

	const requestClose = () => {
		if (!canClose.value) return;
		if (isDirty.value) {
			discardPending.value = true;
			return;
		}
		close();
	};

	const cancelDiscard = () => {
		if (!isSubmitting.value) discardPending.value = false;
	};

	const confirmDiscard = () => {
		if (isSubmitting.value) return;
		discardPending.value = false;
		close();
	};

	const reset = () => {
		discardPending.value = false;
	};

	return {
		discardPending,
		requestClose,
		cancelDiscard,
		confirmDiscard,
		reset,
	};
}
