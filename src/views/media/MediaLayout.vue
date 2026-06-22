<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.media.sidebar.collapsed"
      aria-label="内容导航"
    >
      <div v-if="!sidebarCollapsed" class="p-sidebar-label">{{ moduleRooms.media.name }}</div>
      <div v-if="!sidebarCollapsed" class="p-sidebar-helper">{{ moduleRooms.media.helper }}</div>

      <PSidebarItem to="/create" :index="1" :icon="PenTool">创作</PSidebarItem>
      <PSidebarItem to="/articles" :index="2" :icon="FileText">文章</PSidebarItem>
      <PSidebarItem to="/videos" :index="3" :icon="Video">视频</PSidebarItem>
      <PSidebarItem to="/podcasts" :index="4" :icon="Mic">播客</PSidebarItem>
      <PSidebarItem to="/subscriptions" :index="5" :icon="Rss">订阅</PSidebarItem>
      <PSidebarItem to="/bookmarks" :index="6" :icon="Bookmark">收藏</PSidebarItem>
    </PSidebar>

    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PenTool, FileText, Video, Mic, Rss, Bookmark } from 'lucide-vue-next'
import { moduleRooms } from '@/config/moduleRooms'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarCollapsed = ref(false)
</script>
