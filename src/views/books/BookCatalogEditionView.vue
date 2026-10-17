<template>
  <section class="book-catalog private-books">
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="metadata">
      <h1>{{ metadata.fields.title || '出版版本' }}</h1>
      <RouterLink :to="`/books/work/${metadata.fields.work_id}`">返回作品</RouterLink>
      <dl><template v-for="field in ['publisher', 'producer', 'isbn10', 'isbn13', 'language', 'page_count', 'binding']" :key="field"><dt>{{ labels[field] }}</dt><dd>{{ metadata.fields[field] || '待补充' }}</dd></template></dl>
      <BookWikiPanel kind="edition" :entity-id="metadata.entity_id" :work-id="String(metadata.fields.work_id)" :authenticated="auth.isAuthenticated" @changed="load" />
    </template>
    <PButton v-else variant="secondary" @click="load">重新加载版本</PButton>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { wikiMetadata, type WikiMetadata } from '@/api/bookWiki'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import PButton from '@/components/ui/PButton.vue'
const route = useRoute(), auth = useAuthStore(), metadata = ref<WikiMetadata>(), error = ref('')
const labels: Record<string, string> = { publisher: '出版社', producer: '出品方', isbn10: 'ISBN-10', isbn13: 'ISBN-13', language: '语言', page_count: '页数', binding: '装帧' }
async function load() { try { metadata.value = await wikiMetadata('edition', String(route.params.editionId)); error.value = '' } catch { error.value = '版本不存在或暂不可用，请重试。' } }
onMounted(load)
</script>
