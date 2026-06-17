import path from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080'
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }
const normalizeVersion = (value: string | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) return 'v0.0.0'
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}
const appVersion = normalizeVersion(process.env.VITE_APP_VERSION || packageJson.version)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true, // proxy WebSocket connections (collab hub)
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
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
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) return 'codemirror'
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
})
