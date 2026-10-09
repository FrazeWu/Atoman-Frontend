<template>
  <section class="mobile-module-layout">
    <RouterView v-slot="{ Component, route: viewRoute }">
      <Transition :name="detailTransition">
        <component :is="Component" :key="viewRoute.meta.routeOverlay ? viewRoute.matched[0]?.path : viewRoute.path" />
      </Transition>
    </RouterView>
    <RouterView name="overlay" @close="closeOverlay" />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { moduleUrl } from '@/router/siteUrls'
import { resolveSiteContext } from '@/router/siteContext'
import { isMobileDetailRoute } from './mobileRouteMeta'

const route = useRoute()
const router = useRouter()
const detailTransition = ref('')
watch(() => route.path, (to, from) => {
  detailTransition.value = isMobileDetailRoute(to) ? 'mobile-module-detail' : isMobileDetailRoute(from) ? 'mobile-module-return' : ''
})
const closeOverlay = () => {
  if (window.history.state?.back) {
    router.back()
    return
  }
  const context = resolveSiteContext(window.location.hostname, '', route.path)
  void router.push(context.type === 'module' ? moduleUrl(context.module) : '/modules')
}
</script>

<style scoped>
.mobile-module-layout {
  min-width: 0;
  padding: 1rem;
}
.mobile-module-layout :deep(.a-page),
.mobile-module-layout :deep(.a-page-md),
.mobile-module-layout :deep(.a-page-xl),
.mobile-module-layout :deep(.a-page-sm) {
  padding: 0;
}
</style>
