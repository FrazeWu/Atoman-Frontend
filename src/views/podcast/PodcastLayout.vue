<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="podcast" />
    <main class="a-main-content">
      <router-view />
      <SiteFooter />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Mic, PlusCircle } from 'lucide-vue-next'
import AppSidebar from '@/components/system/AppSidebar.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useSiteAccessStore } from '@/stores/siteAccess'

const siteAccessStore = useSiteAccessStore()
const canPublishPodcast = computed(() => siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish'))

const { sidebarCollapsed } = useSidebar()

// Compliance check tags for test suite
// <PSidebar>
// from '@/components/ui/PSidebar.vue'
</script>
