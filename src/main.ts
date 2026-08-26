import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import "./assets/editor.css";
import "./assets/feed-reader.css";
import { reportError } from "./utils/logger";
import {
  installStaleViteChunkRecovery,
  recoverStaleViteChunk,
} from "./utils/staleViteChunkRecovery";

const isMobileRuntime = () => {
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent,
  );
  return (
    mobileUserAgent ||
    window.matchMedia?.("(max-width: 767px)").matches === true
  );
};

const mobileRuntime = isMobileRuntime();

installStaleViteChunkRecovery();
document.documentElement.dataset.atomanApp = mobileRuntime
  ? "mobile"
  : "desktop";

window.addEventListener("error", (event) => {
  if (recoverStaleViteChunk(event.error || event.message)) return;
  reportError(event.error || event.message, "未处理运行时错误");
});
window.addEventListener("unhandledrejection", (event) => {
  if (recoverStaleViteChunk(event.reason)) return;
  reportError(event.reason, "未处理 Promise 异常");
});

const bootstrap = async () => {
  const appModule = mobileRuntime
    ? await import("../apps/mobile/MobileApp.vue")
    : await import("./App.vue");
  const routerModule = mobileRuntime
    ? await import("../apps/mobile/router")
    : await import("./router");

  const rootComponent = appModule.default;
  const appRouter = routerModule.default;

  const app = createApp(rootComponent);
  app.config.errorHandler = (error, _instance, info) => {
    reportError(error, `${mobileRuntime ? "Vue mobile" : "Vue"}: ${info}`);
  };
  appRouter.onError((error) => {
    if (recoverStaleViteChunk(error)) return;
    reportError(error, `${mobileRuntime ? "移动端" : ""}路由加载失败`);
  });

  app.use(createPinia());
  app.use(appRouter);
  app.mount("#app");
};

void bootstrap().catch((error) => {
  reportError(error, "应用启动失败");
});
