import type { Pinia } from "pinia";
import { getCurrentInstance } from "vue";

export function getMountedPinia(): Pinia | undefined {
	return getCurrentInstance()?.appContext.config.globalProperties.$pinia as
		| Pinia
		| undefined;
}
