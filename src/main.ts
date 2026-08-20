import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/editor.css'
import './assets/feed-reader.css'
import App from './App.vue'
import router from './router'
import { reportError } from './utils/logger'
import { installStaleViteChunkRecovery, recoverStaleViteChunk } from './utils/staleViteChunkRecovery'

installStaleViteChunkRecovery()

const app = createApp(App)
app.config.errorHandler = (error, _instance, info) => {
  reportError(error, `Vue: ${info}`)
}

window.addEventListener('error', (event) => {
  if (recoverStaleViteChunk(event.error || event.message)) return
  reportError(event.error || event.message, '未处理运行时错误')
})
window.addEventListener('unhandledrejection', (event) => {
  if (recoverStaleViteChunk(event.reason)) return
  reportError(event.reason, '未处理 Promise 异常')
})
router.onError((error) => {
  if (recoverStaleViteChunk(error)) return
  reportError(error, '路由加载失败')
})

app.use(createPinia())
app.use(router)
app.mount('#app')
