import {
	hasInjectionContext,
	inject,
	type ComputedRef,
	type InjectionKey,
} from "vue";
import type { MusicCreationFlowState } from "./musicCreationTypes";

export const musicCreationFlowKey: InjectionKey<
	ComputedRef<MusicCreationFlowState | null>
> = Symbol("music-creation-flow");

export function useMusicCreationFlow(
	fallback: ComputedRef<MusicCreationFlowState | null>,
) {
	if (!hasInjectionContext()) return fallback;
	return inject(musicCreationFlowKey, fallback) ?? fallback;
}
