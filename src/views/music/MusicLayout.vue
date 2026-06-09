<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem to="/explore" :index="1" icon-char="探">
        探索
      </PaperSidebarItem>
      <PaperSidebarItem to="/" :index="2" icon-char="艺" exact>
        艺术家
      </PaperSidebarItem>
      <PaperSidebarItem to="/starred" :index="3" icon-char="藏">
        我的收藏
      </PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { moduleRooms } from '@/config/moduleRooms'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'

const sidebarStorageKey = 'atoman.music.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
