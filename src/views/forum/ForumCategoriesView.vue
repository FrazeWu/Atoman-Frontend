<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IconFolder as Folder, IconSearch as Search } from '@tabler/icons-vue'
import { useForumStore } from '@/stores/forum'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const forumStore = useForumStore()
const categories = computed(() => forumStore.categories)

onMounted(() => {
  if (!forumStore.categoriesLoaded) void forumStore.fetchCategories()
})
</script>

<template>
  <div class="a-page-md forum-categories-view">
    <PPageHeader title="分类" mb="1.25rem">
      <template #action>
        <RouterLink to="/forum/search" class="forum-categories__search" aria-label="搜索话题" title="搜索话题"><Search :size="18" aria-hidden="true" /></RouterLink>
      </template>
    </PPageHeader>

    <div v-if="!forumStore.categoriesLoaded" class="forum-categories__state">加载中...</div>
    <PEmpty v-else-if="!categories.length" title="暂无分类" description="论坛分类将在可用时显示在这里。" />
    <nav v-else class="forum-categories__list" aria-label="论坛分类目录">
      <RouterLink
        v-for="category in categories"
        :key="category.id"
        :to="{ path: '/forum', query: { category_id: category.id } }"
        class="forum-categories__item"
      >
        <span class="forum-categories__icon" :style="{ color: category.color || 'var(--a-color-fg)' }"><Folder :size="19" aria-hidden="true" /></span>
        <span class="forum-categories__copy">
          <strong>{{ category.name }}</strong>
          <span>{{ category.description || '浏览这个分类中的话题' }}</span>
        </span>
        <span class="forum-categories__count">{{ category.topic_count || 0 }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.forum-categories-view { min-height: 100%; padding-bottom: 3rem; }
.forum-categories__search { display: inline-flex; min-width: 40px; min-height: 40px; align-items: center; justify-content: center; color: var(--a-color-fg); }
.forum-categories__list { display: grid; gap: 0.5rem; }
.forum-categories__item { display: flex; min-height: 66px; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.forum-categories__item:hover, .forum-categories__item:focus-visible { border-color: var(--a-color-fg); }
.forum-categories__icon { display: inline-flex; flex: 0 0 auto; }
.forum-categories__copy { display: grid; min-width: 0; gap: 0.2rem; flex: 1; }
.forum-categories__copy strong { font-weight: 500; }
.forum-categories__copy span, .forum-categories__count, .forum-categories__state { color: var(--a-color-muted); font-size: 0.8rem; }
.forum-categories__copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.forum-categories__count { flex: 0 0 auto; }
</style>
