import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(frontendRoot, "apps/mobile");

function readPackageVersion() {
	try {
		const packageJson = JSON.parse(
			readFileSync(path.resolve(frontendRoot, "package.json"), "utf8"),
		) as { version?: string };
		return packageJson.version?.trim() || "0.0.0";
	} catch {
		return "0.0.0";
	}
}

const packageVersion = readPackageVersion();

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, frontendRoot, "");
	const apiProxyTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8080";
	const apiProxyOrigin = env.VITE_DEV_PROXY_ORIGIN?.trim();
	const apiProxy = {
		target: apiProxyTarget,
		changeOrigin: true,
		...(apiProxyOrigin ? { headers: { Origin: apiProxyOrigin } } : {}),
	};

	return {
		root: mobileRoot,
		define: {
			__APP_VERSION__: JSON.stringify(`v${packageVersion}`),
		},
		server: {
			host: "0.0.0.0",
			port: Number(env.VITE_MOBILE_DEV_PORT || 5174),
			fs: { allow: [frontendRoot] },
			proxy: {
				"/api": { ...apiProxy, ws: true },
				"/uploads": { ...apiProxy },
			},
		},
		preview: {
			host: "0.0.0.0",
			port: Number(env.VITE_MOBILE_PREVIEW_PORT || 4174),
			proxy: {
				"/api": { ...apiProxy },
				"/uploads": { ...apiProxy },
			},
		},
		resolve: {
			alias: {
				"@": path.resolve(frontendRoot, "src"),
				"@mobile": mobileRoot,
				"@atoman/module-config": path.resolve(
					frontendRoot,
					"packages/module-config/src/index.ts",
				),
				"@atoman/api-client": path.resolve(
					frontendRoot,
					"packages/api-client/src/index.ts",
				),
			},
		},
		plugins: [tailwindcss(), vue()],
		build: {
			outDir: path.resolve(frontendRoot, "dist-mobile"),
			emptyOutDir: true,
			chunkSizeWarningLimit: 1700,
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (id.includes("node_modules/highlight.js")) return "highlight";
						if (id.includes("node_modules/marked")) return "markdown-runtime";
						if (
							id.includes("node_modules/yjs") ||
							id.includes("node_modules/y-websocket") ||
							id.includes("node_modules/y-protocols") ||
							id.includes("node_modules/lib0") ||
							id.includes("node_modules/y-codemirror")
						)
							return "yjs";
						if (
							id.includes("node_modules/vue") ||
							id.includes("node_modules/vue-router") ||
							id.includes("node_modules/pinia")
						) {
							return "vue-core";
						}
					},
				},
			},
		},
	};
});
