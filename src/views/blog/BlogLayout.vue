<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.blog.sidebar.collapsed"
    >
      <PSidebarItem to="/posts" :index="1" :icon="Compass" exact>
        探索
      </PSidebarItem>
      <PSidebarItem to="/posts/subscriptions" :index="2" :icon="Rss">
        订阅
      </PSidebarItem>
      <PSidebarItem to="/posts/manage" :index="3" :icon="Settings">
        管理
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Compass, Rss, Settings } from 'lucide-vue-next'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarCollapsed = ref(false)
</script>
