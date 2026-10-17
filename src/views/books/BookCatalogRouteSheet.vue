<template>
  <PSheet :show="true" :title="view === 'create' ? '添加图书' : '图书详情'" mode="full" :side="isMobile ? 'bottom' : 'right'" close-type="header" @close="close">
    <component :is="views[view]" :key="route.path" />
  </PSheet>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PSheet from '@/components/ui/PSheet.vue'
defineProps<{ view: 'create' | 'work' | 'edition' }>()
const views = {
  create: defineAsyncComponent(() => import('./BookCreateView.vue')),
  work: defineAsyncComponent(() => import('./BookCatalogWorkView.vue')),
  edition: defineAsyncComponent(() => import('./BookCatalogEditionView.vue')),
}
const route = useRoute()
const router = useRouter()
const isMobile = ref(false)
let viewport: MediaQueryList | undefined
function syncViewport() { isMobile.value = viewport?.matches ?? false }
onMounted(() => { viewport = window.matchMedia?.('(max-width: 767px)'); syncViewport(); viewport?.addEventListener('change', syncViewport) })
onBeforeUnmount(() => viewport?.removeEventListener('change', syncViewport))
function close() {
  if (route.query.from) { void router.replace(String(route.query.from)); return }
  if (window.history.state?.back) { router.back(); return }
  void router.replace({ path: '/books', query: { q: route.query.q, page: route.query.page } })
}
</script>
