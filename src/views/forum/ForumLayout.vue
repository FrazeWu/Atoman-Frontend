<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <!-- All topics -->
      <PaperSidebarItem
        to="/"
        index="1"
        icon-char="全"
        :active="!$route.query.category_id && !$route.query.tag"
        exact
      >
        所有话题
      </PaperSidebarItem>

      <div class="a-sidebar-divider" />

      <!-- Categories section -->
      <div class="a-sidebar-label">/ CATEGORIES</div>
      <PaperSidebarItem
        v-for="cat in forumStore.categories"
        :key="cat.id"
        :icon-char="cat.name.charAt(0)"
        :active="$route.query.category_id === String(cat.id)"
        @click="selectCategory(cat.id)"
      >
        <span
          class="sidebar-cat-dot"
          :style="{ background: cat.color || 'var(--a-color-fg)' }"
        />
        <span style="flex:1">{{ cat.name }}</span>
        <span class="a-label" style="font-size:0.7rem">{{ cat.topic_count || 0 }}</span>
      </PaperSidebarItem>

      <div class="a-sidebar-divider" />

      <!-- Tags section -->
      <div class="a-sidebar-label">/ TAGS</div>
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

      <template #bottom>
        <!-- Keyboard shortcuts hint -->
        <div style="padding:1rem 2rem;font-size:0.7rem;color:var(--a-color-muted-soft)">
          <div style="margin-bottom:0.25rem"><kbd>J</kbd> <kbd>K</kbd> 上下选择</div>
          <div style="margin-bottom:0.25rem"><kbd>Enter</kbd> 打开话题</div>
          <div style="margin-bottom:0.25rem"><kbd>N</kbd> 发新话题</div>
          <div><kbd>/</kbd> 搜索</div>
        </div>
      </template>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { moduleRooms } from '@/config/moduleRooms'
import { useForumStore } from '@/stores/forum'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()

const sidebarStorageKey = 'atoman.forum.sidebar.collapsed'
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
  router.push({ path: '/', query: { category_id: String(id) } })
}

const selectTag = (tag: string) => {
  if (route.query.tag === tag) {
    router.push({ path: '/' })
  } else {
    router.push({ path: '/', query: { tag } })
  }
}

onMounted(async () => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
  if (forumStore.categories.length === 0) {
    await forumStore.fetchCategories()
  }
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
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
kbd {
  font-family: inherit;
  background: #fff;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.1rem 0.3rem;
  border-radius: 0;
  font-weight: 900;
}
</style>
