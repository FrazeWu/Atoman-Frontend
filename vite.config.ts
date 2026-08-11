import path from 'path'
import { readFileSync } from 'fs'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }
const normalizeVersion = (value: string | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) return 'v0.0.0'
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080'
  const apiProxyOrigin = env.VITE_DEV_PROXY_ORIGIN?.trim()
  const objectStorageProxyTarget = env.VITE_DEV_OBJECT_STORAGE_PROXY_TARGET || 'http://127.0.0.1:9100'
  const appVersion = normalizeVersion(env.VITE_APP_VERSION || packageJson.version)
  const apiProxy = {
    target: apiProxyTarget,
    changeOrigin: true,
    ...(apiProxyOrigin ? { headers: { Origin: apiProxyOrigin } } : {}),
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          ...apiProxy,
          ws: true, // proxy WebSocket connections (collab hub)
        },
        '/uploads': {
          ...apiProxy,
        },
        '/__object-storage': {
          target: objectStorageProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__object-storage/, ''),
        },
      },
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          ...apiProxy,
        },
        '/uploads': {
          ...apiProxy,
        },
        '/__object-storage': {
          target: objectStorageProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__object-storage/, ''),
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/highlight.js')) return 'highlight'
            if (id.includes('node_modules/marked')) return 'markdown-runtime'
            if (id.includes('node_modules/yjs') || id.includes('node_modules/y-websocket') || id.includes('node_modules/y-protocols') || id.includes('node_modules/lib0') || id.includes('node_modules/y-codemirror')) return 'yjs'
            if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) {
              return 'vue-core'
            }
          },
        },
      },
    },
    plugins: [tailwindcss(), vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
