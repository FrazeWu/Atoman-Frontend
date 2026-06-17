<template>
  <div class="a-module-layout">
    <PSidebar :label="moduleRooms.kanbo.name" :helper="moduleRooms.kanbo.helper" aria-label="内容导航">
      <PSidebarItem to="/create" :index="1">创作</PSidebarItem>
      <PSidebarItem to="/articles" :index="2">文章</PSidebarItem>
      <PSidebarItem to="/videos" :index="3">视频</PSidebarItem>
      <PSidebarItem to="/podcasts" :index="4">播客</PSidebarItem>
      <PSidebarItem to="/subscriptions" :index="5">订阅</PSidebarItem>
      <PSidebarItem to="/bookmarks" :index="6">收藏</PSidebarItem>
    </PSidebar>

    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { moduleRooms } from '@/config/moduleRooms'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
</script>
