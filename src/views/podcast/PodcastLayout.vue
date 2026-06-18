<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PSidebarItem
        to="/"
        :index="1"
        :icon="Mic"
        exact
      >
        播客大厅
      </PSidebarItem>
      <PSidebarItem
        v-if="canPublishPodcast"
        to="/editor"
        :index="2"
        :icon="PlusCircle"
      >
        发布单集
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Mic, PlusCircle } from 'lucide-vue-next'
import { moduleRooms } from '@/config/moduleRooms'
import { useSiteAccessStore } from '@/stores/siteAccess'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

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
