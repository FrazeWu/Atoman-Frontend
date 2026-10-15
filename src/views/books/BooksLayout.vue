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
    <BookWorkDrawer
      v-if="activeWorkId"
      :work-id="activeWorkId"
      :show="Boolean(activeWorkId)"
      @close="closeWorkDrawer"
    />
    <RouterView name="overlay" v-slot="{ Component }">
      <PSheet v-if="Component && !activeWorkId" :show="true" title="书籍详情" :side="isMobile ? 'bottom' : 'right'" close-type="header" @close="closeDetail">
        <component :is="Component" :key="route.path" />
      </PSheet>
    </RouterView>
    <BookMiniReaderBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/system/AppSidebar.vue'
import PSheet from '@/components/ui/PSheet.vue'
import BookWorkDrawer from '@/components/books/BookWorkDrawer.vue'
import BookMiniReaderBar from '@/components/books/BookMiniReaderBar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
const route = useRoute()
const router = useRouter()
const isMobile = ref(false)

const activeWorkId = computed(() => {
  return typeof route.params.workId === 'string' ? route.params.workId : ''
})

function closeWorkDrawer() {
  if (route.query.from) {
    void router.replace(String(route.query.from))
  } else if (window.history.state?.back) {
    router.back()
  } else {
    void router.replace('/books')
  }
}

let viewport: MediaQueryList | undefined
function syncViewport() { isMobile.value = viewport?.matches ?? false }
onMounted(() => {
  viewport = window.matchMedia?.('(max-width: 767px)')
  syncViewport()
  viewport?.addEventListener('change', syncViewport)
})
onBeforeUnmount(() => viewport?.removeEventListener('change', syncViewport))
function closeDetail() {
  if (window.history.state?.back) router.back()
  else void router.replace('/books')
}
</script>
