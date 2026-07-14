<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      class="forum-sidebar"
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.forum.sidebar.collapsed"
    >
      <!-- All topics -->
      <PSidebarItem
        :to="moduleUrl('forum')"
        index="1"
        :icon="MessageSquare"
        :active="!$route.query.category_id && !$route.query.tag"
        exact
      >
        所有话题
      </PSidebarItem>

      <div v-if="!sidebarCollapsed" class="p-sidebar-divider" />

      <!-- Categories section -->
      <div class="p-sidebar-label">分类</div>
      <PSidebarItem
        v-for="cat in forumStore.categories"
        :key="cat.id"
        :icon="Folder"
        :active="$route.query.category_id === String(cat.id)"
        @click="selectCategory(cat.id)"
      >
        <span
          class="sidebar-cat-dot"
          :style="{ background: cat.color || 'var(--a-color-fg)' }"
        />
        <span style="flex:1">{{ cat.name }}</span>
        <span class="a-label" style="font-size:0.7rem">{{ cat.topic_count || 0 }}</span>
      </PSidebarItem>

      <div v-if="!sidebarCollapsed" class="p-sidebar-divider" />

      <!-- Tags section -->
      <template v-if="!sidebarCollapsed">
        <div class="p-sidebar-label">标签</div>
        <div style="padding:0.5rem 2rem;display:flex;flex-wrap:wrap;gap:0.35rem">
          <button
            v-for="tag in popularTags"
            :key="tag"
            class="forum-sidebar-tag"
            :class="{ active: $route.query.tag === tag }"
            @click="selectTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </template>

    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare, Folder } from 'lucide-vue-next'
import { useForumStore } from '@/stores/forum'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import { moduleUrl } from '@/router/siteUrls'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()

const sidebarCollapsed = ref(false)

// Popular tags - computed from forumStore topics
const popularTags = computed(() => {
  const tagCount: Record<string, number> = {}
  forumStore.topics.forEach((t) => {
    ;(t.tags || []).forEach((tag) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag)
})

const selectCategory = (id: string | number) => {
  router.push({ path: moduleUrl('forum'), query: { category_id: String(id) } })
}

const selectTag = (tag: string) => {
  if (route.query.tag === tag) {
    router.push({ path: moduleUrl('forum') })
  } else {
    router.push({ path: moduleUrl('forum'), query: { tag } })
  }
}

onMounted(async () => {
  if (forumStore.categories.length === 0) {
    await forumStore.fetchCategories()
  }
})
</script>

<style scoped>
.sidebar-cat-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  margin-right: 0.5rem;
  flex-shrink: 0;
}
.forum-sidebar-tag {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.1s;
  text-transform: uppercase;
}
.forum-sidebar-tag:hover {
  border-color: var(--a-color-fg);
  color: var(--a-color-fg);
}
.forum-sidebar-tag.active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
</style>
