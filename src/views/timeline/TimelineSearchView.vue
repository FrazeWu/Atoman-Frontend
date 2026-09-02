<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IconSearch as Search } from '@tabler/icons-vue'
import { storeToRefs } from 'pinia'
import { useTimelineStore } from '@/stores/timeline'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const store = useTimelineStore()
const { persons, personsLoading: loading, personsError: error } = storeToRefs(store)
const query = ref('')
const submittedQuery = ref('')

async function search() {
  submittedQuery.value = query.value.trim()
  if (!submittedQuery.value) return
  await store.fetchPersons({ search: submittedQuery.value, page: 1, limit: 30 })
}

const hasResults = computed(() => persons.value.length > 0)

onMounted(() => {
  if (!persons.value.length) void store.fetchPersons({ page: 1, limit: 30 })
})
</script>

<template>
  <div class="a-page-md timeline-search-view">
    <PPageHeader title="搜索" mb="1.25rem" />
    <form class="timeline-search__form" @submit.prevent="search">
      <PInput v-model="query" type="search" placeholder="搜索人物" autofocus />
      <button type="submit" aria-label="开始搜索" title="开始搜索"><Search :size="18" aria-hidden="true" /></button>
    </form>
    <p v-if="error" class="timeline-search__error" role="alert">搜索失败，请重试</p>
    <p v-else-if="loading" class="timeline-search__state">搜索中...</p>
    <PEmpty v-else-if="!submittedQuery && !hasResults" title="搜索人物" description="输入人物姓名查找时间线人物档案。" />
    <PEmpty v-else-if="!hasResults" title="没有找到人物" description="换一个姓名再试。" />
    <nav v-else class="timeline-search__results" aria-label="人物搜索结果">
      <RouterLink v-for="person in persons" :key="person.id" :to="`/timeline/person/${person.id}`">
        <strong>{{ person.name }}</strong>
        <span>{{ person.bio || '查看人物时间线' }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.timeline-search-view { min-height: 100%; padding-bottom: 3rem; }
.timeline-search__form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.timeline-search__form :deep(input) { min-width: 0; }
.timeline-search__form button { display: inline-flex; width: 46px; flex: 0 0 46px; align-items: center; justify-content: center; border: 1px solid var(--a-color-fg); background: var(--a-color-fg); color: var(--a-color-bg); cursor: pointer; }
.timeline-search__state, .timeline-search__error { color: var(--a-color-muted); }
.timeline-search__error { color: var(--a-color-danger); }
.timeline-search__results { display: grid; gap: 0.5rem; }
.timeline-search__results a { display: grid; gap: 0.35rem; padding: 0.9rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.timeline-search__results a:hover, .timeline-search__results a:focus-visible { border-color: var(--a-color-fg); }
.timeline-search__results strong { font-weight: 500; }
.timeline-search__results span { color: var(--a-color-muted); font-size: 0.8rem; }
</style>
