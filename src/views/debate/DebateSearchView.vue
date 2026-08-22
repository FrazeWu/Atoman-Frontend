<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useDebateStore } from '@/stores/debate'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const store = useDebateStore()
const query = ref('')
const submittedQuery = ref('')
const loading = computed(() => store.loading)
const results = computed(() => store.debates)

async function search() {
  submittedQuery.value = query.value.trim()
  if (!submittedQuery.value) return
  await store.fetchDebates({ search: submittedQuery.value, page: 1, pageSize: 20 })
}

watch(query, (value) => {
  if (!value.trim()) {
    submittedQuery.value = ''
    store.debates.splice(0)
  }
})
</script>

<template>
  <div class="a-page-md debate-search-view">
    <PPageHeader title="搜索" mb="1.25rem" />
    <form class="debate-search__form" @submit.prevent="search">
      <PInput v-model="query" type="search" placeholder="搜索辩题、正文或标签" autofocus />
      <button type="submit" class="debate-search__submit" aria-label="开始搜索" title="开始搜索"><Search :size="18" aria-hidden="true" /></button>
    </form>

    <div v-if="loading" class="debate-search__state">搜索中...</div>
    <PEmpty v-else-if="!submittedQuery" title="查找辩题" description="输入关键词搜索辩题标题、正文和标签。" />
    <PEmpty v-else-if="!results.length" title="没有找到辩题" description="换一个关键词再试。" />
    <div v-else class="debate-search__results">
      <RouterLink v-for="debate in results" :key="debate.id" :to="`/debate/${debate.id}`" class="debate-search__result">
        <strong>{{ debate.title }}</strong>
        <span>{{ debate.description || '查看辩题内容' }}</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.debate-search-view { min-height: 100%; padding-bottom: 3rem; }
.debate-search__form { display: flex; align-items: stretch; gap: 0.5rem; margin-bottom: 1.5rem; }
.debate-search__form :deep(input) { min-width: 0; }
.debate-search__submit { display: inline-flex; width: 46px; flex: 0 0 46px; align-items: center; justify-content: center; border: 1px solid var(--a-color-fg); background: var(--a-color-fg); color: var(--a-color-bg); cursor: pointer; }
.debate-search__state { color: var(--a-color-muted); }
.debate-search__results { display: grid; gap: 0.5rem; }
.debate-search__result { display: grid; gap: 0.35rem; padding: 0.9rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.debate-search__result:hover, .debate-search__result:focus-visible { border-color: var(--a-color-fg); }
.debate-search__result strong { font-weight: 500; }
.debate-search__result span { color: var(--a-color-muted); font-size: 0.8rem; }
</style>
