<template>
  <div class="a-module-layout books-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="books" />
    <main class="a-main-content books-main-content">
      <div class="a-content-frame">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </div>
    </main>
    <RouterView name="overlay" v-slot="{ Component }">
      <PSheet
        v-if="Component"
        :show="true"
        title="书籍详情"
        mode="partial"
        partial-width="var(--a-comment-sheet-width)"
        :side="isMobile ? 'bottom' : 'right'"
        close-type="header"
        @close="closeDetail"
      >
        <component :is="Component" :key="route.path" />
      </PSheet>
    </RouterView>
    <BookMiniReaderBar />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/system/AppSidebar.vue'
import PSheet from '@/components/ui/PSheet.vue'
import BookMiniReaderBar from '@/components/books/BookMiniReaderBar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
const route = useRoute()
const router = useRouter()
const isMobile = ref(false)

let viewport: MediaQueryList | undefined
function syncViewport() { isMobile.value = viewport?.matches ?? false }
onMounted(() => {
  viewport = window.matchMedia?.('(max-width: 767px)')
  syncViewport()
  viewport?.addEventListener('change', syncViewport)
})
onBeforeUnmount(() => viewport?.removeEventListener('change', syncViewport))

function closeDetail() {
  if (route.query.from) {
    void router.replace(String(route.query.from))
  } else if (window.history.state?.back) {
    router.back()
  } else {
    void router.replace('/books')
  }
}
</script>
