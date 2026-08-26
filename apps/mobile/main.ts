import { createApp } from "vue";
import { createPinia } from "pinia";
import { reportError } from "@/utils/logger";
import {
	installStaleViteChunkRecovery,
	recoverStaleViteChunk,
} from "@/utils/staleViteChunkRecovery";
import "../../src/style.css";
import "../../src/assets/editor.css";
import "../../src/assets/feed-reader.css";

installStaleViteChunkRecovery();
document.documentElement.dataset.atomanApp = "mobile";

const bootstrap = async () => {
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

	app.use(createPinia());
	app.use(router);
	app.mount("#app");
};

void bootstrap().catch((error) => {
	reportError(error, "应用启动失败");
});
