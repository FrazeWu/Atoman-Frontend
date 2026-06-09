<template>
  <div class="a-module-layout">
    <PaperSidebar :label="moduleRooms.kanbo.name" :helper="moduleRooms.kanbo.helper" aria-label="刊播导航">
      <PaperSidebarItem to="/create" :index="1">创作</PaperSidebarItem>
      <PaperSidebarItem to="/articles" :index="2">文章</PaperSidebarItem>
      <PaperSidebarItem to="/videos" :index="3">视频</PaperSidebarItem>
      <PaperSidebarItem to="/podcasts" :index="4">播客</PaperSidebarItem>
      <PaperSidebarItem to="/subscriptions" :index="5">订阅</PaperSidebarItem>
      <PaperSidebarItem to="/bookmarks" :index="6">收藏</PaperSidebarItem>
    </PaperSidebar>

    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { moduleRooms } from '@/config/moduleRooms'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'
</script>
