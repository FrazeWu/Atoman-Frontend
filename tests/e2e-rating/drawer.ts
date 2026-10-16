import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '../../src/stores/auth'
import BookWorkDrawer from '../../src/components/books/BookWorkDrawer.vue'
import '../../src/style.css'

const pinia = createPinia()
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
await router.push('/')
await useAuthStore(pinia).restoreSession()
createApp({
  render: () => h(BookWorkDrawer, { workId: new URLSearchParams(location.search).get('workId') || '', show: true }),
}).use(pinia).use(router).mount('#app')
