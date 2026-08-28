<template>
  <main class="a-page-md books-detail">
    <PSectionHeader title="版本详情" kicker="EDITION" rule />
    <p v-if="errorMessage" class="books-detail__feedback books-detail__feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="books-detail__feedback" aria-live="polite">正在加载版本...</p>
    <template v-else-if="detail">
      <header class="books-detail__header">
        <RouterLink class="books-detail__back" :to="`/books/work/${detail.work.id}`">返回作品</RouterLink>
        <h1>{{ detail.edition.title || detail.work.title }}</h1>
        <p>{{ detail.work.title }}</p>
      </header>

      <dl class="books-edition-facts">
        <template v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </template>
      </dl>

      <section v-if="detail.sources?.length" class="books-detail__section">
        <h2>资料来源</h2>
        <ul class="books-source-list">
          <li v-for="source in detail.sources" :key="source.url">
            <a :href="source.url" target="_blank" rel="noreferrer noopener">{{ source.title || source.url }}</a>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { getPublicBookEdition, type BookPublicEditionDetail } from '@/api/books'

const route = useRoute()
const detail = ref<BookPublicEditionDetail | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

const facts = computed(() => {
  if (!detail.value) return []
  const edition = detail.value.edition
  return [
    { label: '出版社', value: edition.publisher || '待补充' },
    { label: 'ISBN-10', value: edition.isbn10 || '待补充' },
    { label: 'ISBN-13', value: edition.isbn13 || '待补充' },
    { label: '语言', value: edition.language || '待补充' },
    { label: '页数', value: edition.page_count ? `${edition.page_count} 页` : '待补充' },
    { label: '装帧', value: edition.binding || '待补充' },
  ]
})

onMounted(async () => {
  try {
    detail.value = await getPublicBookEdition(String(route.params.editionId || ''))
  } catch {
    errorMessage.value = '版本不存在或尚未公开'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.books-detail {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
}

.books-detail__header {
  display: grid;
  gap: 0.45rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-detail__back,
.books-detail__header p,
.books-detail__feedback,
.books-detail__muted {
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-detail__back {
  text-decoration: none;
}

.books-detail__back:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.books-detail h1 {
  margin: 0.25rem 0 0;
  font-size: 1.8rem;
  overflow-wrap: anywhere;
}

.books-detail__header p,
.books-detail__feedback,
.books-detail__muted {
  margin: 0;
  line-height: 1.7;
}

.books-detail__feedback--error {
  color: var(--a-color-danger);
}

.books-edition-facts {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
  margin: 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-edition-facts dt,
.books-edition-facts dd {
  margin: 0;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-edition-facts dt {
  color: var(--a-color-muted);
}

.books-edition-facts dd {
  color: var(--a-color-fg);
}

.books-detail__section {
  display: grid;
  gap: 0.7rem;
}

.books-detail__section h2 {
  margin: 0;
  font-size: 1.05rem;
}

.books-source-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-source-list li {
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-source-list a {
  display: block;
  padding: 0.8rem 0;
  color: var(--a-color-fg);
  text-decoration: none;
}

.books-source-list a:hover {
  text-decoration: underline;
}
</style>
