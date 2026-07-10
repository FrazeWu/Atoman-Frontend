<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.podcast.sidebar.collapsed"
    >
      <PSidebarItem
        to="/podcasts"
        :index="1"
        :icon="Mic"
        exact
      >
        探索
      </PSidebarItem>
      <PSidebarItem
        to="/podcasts/subscriptions"
        :index="2"
        :icon="ListMusic"
      >
        订阅
      </PSidebarItem>
      <PSidebarItem
        to="/podcasts/favorites"
        :index="3"
        :icon="Heart"
      >
        收藏
      </PSidebarItem>
      <PSidebarItem
        v-if="canPublishPodcast"
        to="/podcasts/creator"
        :index="4"
        :icon="PlusCircle"
      >
        创作
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Heart, ListMusic, Mic, PlusCircle } from 'lucide-vue-next'
import { useSiteAccessStore } from '@/stores/siteAccess'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const siteAccessStore = useSiteAccessStore()
const canPublishPodcast = computed(() => siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish'))

const sidebarCollapsed = ref(false)
</script>
