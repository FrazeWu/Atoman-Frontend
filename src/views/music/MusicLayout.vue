<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PSidebarItem to="/explore" :index="1" icon-char="探">
        探索
      </PSidebarItem>
      <PSidebarItem to="/" :index="2" icon-char="艺" exact>
        艺术家
      </PSidebarItem>
      <PSidebarItem to="/starred" :index="3" icon-char="藏">
        我的收藏
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { moduleRooms } from '@/config/moduleRooms'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarStorageKey = 'atoman.music.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
