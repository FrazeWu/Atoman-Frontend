import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/editor.css'
import App from './App.vue'
import router from './router'
import { reportError } from './utils/logger'

const app = createApp(App)
app.config.errorHandler = (error, _instance, info) => {
  reportError(error, `Vue: ${info}`)
}

window.addEventListener('error', (event) => {
  reportError(event.error || event.message, '未处理运行时错误')
})
window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, '未处理 Promise 异常')
})

app.use(createPinia())
app.use(router)
app.mount('#app')
