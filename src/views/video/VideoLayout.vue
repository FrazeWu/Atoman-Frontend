<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem to="/" :index="1" icon-char="探" exact>
        探索
      </PaperSidebarItem>
      <PaperSidebarItem to="/subscriptions" :index="2" icon-char="订">
        订阅
      </PaperSidebarItem>
      <PaperSidebarItem to="/manage" :index="3" icon-char="管">
        管理
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

const sidebarStorageKey = 'atoman.video.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
