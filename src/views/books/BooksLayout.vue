<template>
  <div class="a-module-layout books-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="books" />
    <main class="a-main-content books-main-content">
      <div class="a-content-frame">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.meta.bookCatalog ? 'books-catalog' : route.path" />
        </RouterView>
      </div>
    </main>
    <RouterView name="overlay" />
    <BookMiniReaderBar />
  </div>
</template>

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/system/AppSidebar.vue'
import BookMiniReaderBar from '@/components/books/BookMiniReaderBar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { sidebarCollapsed } = useSidebar()
const route = useRoute()
</script>
