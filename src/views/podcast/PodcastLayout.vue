<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem
        to="/"
        :index="1"
        icon-char="播"
        exact
      >
        播客大厅
      </PaperSidebarItem>
      <PaperSidebarItem
        v-if="canPublishPodcast"
        to="/editor"
        :index="2"
        icon-char="发"
      >
        发布单集
      </PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { moduleRooms } from '@/config/moduleRooms'
import { useSiteAccessStore } from '@/stores/siteAccess'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'

const siteAccessStore = useSiteAccessStore()
const canPublishPodcast = computed(() => siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish'))

const sidebarStorageKey = 'atoman.podcast.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
