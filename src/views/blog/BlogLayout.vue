<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PSidebarItem to="/" :index="1" :icon="Compass" exact>
        探索
      </PSidebarItem>
      <PSidebarItem to="/subscriptions" :index="2" :icon="Rss">
        订阅
      </PSidebarItem>
      <PSidebarItem to="/manage" :index="3" :icon="Settings">
        管理
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Compass, Rss, Settings } from 'lucide-vue-next'
import { moduleRooms } from '@/config/moduleRooms'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarStorageKey = 'atoman.blog.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
