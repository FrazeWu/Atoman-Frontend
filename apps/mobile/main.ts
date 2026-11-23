import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createQueryClient } from "@/app/providers/queryClient";
import { installProductionErrorReporting } from "@/utils/clientErrorReport";
import { initMediaOfflineCacheIndex } from "@/utils/mediaOfflineCache";
import { reportError } from "@/utils/logger";
import {
	installStaleViteChunkRecovery,
	recoverStaleViteChunk,
} from "@/utils/staleViteChunkRecovery";
import { waitForInitialPaint } from "@/utils/waitForInitialPaint";
import "../../src/style.css";

installProductionErrorReporting();
installStaleViteChunkRecovery();
document.documentElement.dataset.atomanApp = "mobile";

const bootstrap = async () => {
	await waitForInitialPaint();

	const [{ default: MobileApp }, { default: router }] = await Promise.all([
		import("./MobileApp.vue"),
		import("./router"),
	]);

	const app = createApp(MobileApp);
	app.config.errorHandler = (error, _instance, info) => {
		reportError(error, `Vue mobile: ${info}`);
	};

	window.addEventListener("error", (event) => {
		if (recoverStaleViteChunk(event.error || event.message)) return;
		reportError(event.error || event.message, "未处理运行时错误");
	});
	window.addEventListener("unhandledrejection", (event) => {
		if (recoverStaleViteChunk(event.reason)) return;
		reportError(event.reason, "未处理 Promise 异常");
	});
	router.onError((error) => {
		if (recoverStaleViteChunk(error)) return;
		reportError(error, "移动端路由加载失败");
	});

	app.use(VueQueryPlugin, { queryClient: createQueryClient() });
	app.use(createPinia());
	app.use(router);
	app.mount("#app");
	void initMediaOfflineCacheIndex();
};

void bootstrap().catch((error) => {
	reportError(error, "应用启动失败");
});
