import { computed, shallowRef } from "vue";

export interface BaseSheetLayer {
	key: string;
	kind: string;
	title: string;
	route?: string;
	returnFocusTo?: HTMLElement | null;
}

const activeElement = () =>
	document.activeElement instanceof HTMLElement ? document.activeElement : null;

interface SheetStackOptions<T> {
	maxLayers?: number;
	resolveOverflow?: (next: T, current: readonly T[]) => T[];
	overflowTransitionMs?: number;
	leaveTransitionMs?: number;
}

export function createSheetStack<T extends BaseSheetLayer>(
	options: SheetStackOptions<T> = {},
) {
	const layers = shallowRef<T[]>([]);
	const renderLayers = shallowRef<T[]>([]);
	const top = computed<T | null>(() => layers.value.at(-1) ?? null);
	const leaveTransitionMs = options.leaveTransitionMs ?? 220;
	let renderTimer: number | null = null;
	let renderTransitionCanBeInterrupted = false;
	const withFocusTarget = (layer: T) =>
		({
			...layer,
			returnFocusTo: layer.returnFocusTo ?? activeElement(),
		}) as T;

	const cancelRenderTransition = () => {
		if (renderTimer === null) return;
		window.clearTimeout(renderTimer);
		renderTimer = null;
		renderTransitionCanBeInterrupted = false;
	};

	const scheduleRenderSync = () => {
		cancelRenderTransition();
		renderTransitionCanBeInterrupted = true;
		renderTimer = window.setTimeout(() => {
			renderLayers.value = layers.value;
			renderTimer = null;
			renderTransitionCanBeInterrupted = false;
		}, leaveTransitionMs);
	};

	function push(layer: T) {
		if (renderTimer !== null) {
			if (!renderTransitionCanBeInterrupted) return;
			cancelRenderTransition();
		}
		if (top.value?.key === layer.key) return;
		if (layers.value.some((item) => item.key === layer.key)) {
			popTo(layer.key);
			return;
		}
		const next = withFocusTarget(layer);

		if (options.maxLayers && layers.value.length >= options.maxLayers) {
			const resolved = options.resolveOverflow?.(next, layers.value) ?? [next];
			layers.value = resolved.slice(-options.maxLayers).map(withFocusTarget);
			const transitionMs = options.overflowTransitionMs ?? 0;
			if (transitionMs > 0) {
				renderLayers.value = [
					...renderLayers.value.filter((item) => item.key !== next.key),
					next,
				];
				renderTimer = window.setTimeout(() => {
					renderLayers.value = layers.value;
					renderTimer = null;
				}, transitionMs);
			} else {
				renderLayers.value = layers.value;
			}
			return;
		}

		layers.value = [...layers.value, next];
		renderLayers.value = layers.value;
	}

	function replaceTop(layer: T, preserveKey = false) {
		cancelRenderTransition();
		const current = top.value;
		layers.value = [
			...layers.value.slice(0, -1),
			{
				...layer,
				key: preserveKey && current ? current.key : layer.key,
				returnFocusTo:
					layer.returnFocusTo ?? current?.returnFocusTo ?? activeElement(),
			},
		] as T[];
		renderLayers.value = layers.value;
	}

	function restore(layer?: T) {
		if (layer?.returnFocusTo?.isConnected) {
			window.setTimeout(() => layer.returnFocusTo?.focus(), 0);
		}
	}

	function pop() {
		cancelRenderTransition();
		const removed = top.value ?? undefined;
		layers.value = layers.value.slice(0, -1);
		scheduleRenderSync();
		restore(removed);
		return removed;
	}

	function popTo(key: string) {
		cancelRenderTransition();
		const index = layers.value.findIndex((layer) => layer.key === key);
		if (index < 0) return;
		layers.value = layers.value.slice(0, index + 1);
		scheduleRenderSync();
	}

	function clear() {
		cancelRenderTransition();
		const first = layers.value[0];
		layers.value = [];
		scheduleRenderSync();
		restore(first);
	}

	const isTop = (key: string) => top.value?.key === key;
	const isActive = (key: string) =>
		layers.value.some((layer) => layer.key === key);
	const isShifted = (key: string) => {
		const index = layers.value.findIndex((layer) => layer.key === key);
		return index >= 0 && index < layers.value.length - 1;
	};

	return {
		layers,
		renderLayers,
		top,
		push,
		replaceTop,
		pop,
		popTo,
		clear,
		isTop,
		isActive,
		isShifted,
	};
}
