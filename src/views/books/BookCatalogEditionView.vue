<template>
  <section class="book-catalog private-books">
    <p v-if="loading" role="status">正在加载版本…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><PButton variant="secondary" @click="load">重新加载版本</PButton></div>
    <template v-else-if="metadata && work && edition">
      <div class="book-catalog__hero">
        <div class="book-catalog__cover-col">
          <BookCover
            variant="edition"
            :src="edition.cover_url"
            :title="edition.title || work.title"
            :author="edition.publisher || work.authors.map(person => person.name).join(' / ')"
            eager
          />
        </div>
        <div class="book-catalog__info-col">
          <h1>{{ edition.title || work.title }}</h1>
          <p v-if="edition.subtitle" class="book-catalog__work-subtitle">{{ edition.subtitle }}</p>
          <p class="book-catalog__edition-parent-link">
            <RouterLink :to="`/books/work/${work.id}`">所属作品：{{ work.title }}</RouterLink>
          </p>
          <p class="book-catalog__authors">
            <span>{{ work.authors.map(person => person.name).join(' / ') }} 著</span>
            <span v-if="edition.translators?.length" class="ml-2"> · {{ edition.translators.map(person => person.name).join(' / ') }} 译</span>
          </p>
          <dl class="book-catalog__details-dl"><template v-for="field in fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value || '待补充' }}</dd></template></dl>
          <div class="book-catalog__hero-actions">
            <BookWikiPanel kind="edition" :entity-id="metadata.entity_id" :work-id="work.id" :authenticated="auth.isAuthenticated" @changed="load" />
          </div>
        </div>
      </div>
      <h2>这个版本的电子文件</h2>
      <p v-if="resourceError" role="alert">{{ resourceError }}<PButton variant="secondary" @click="loadResources">重试加载文件</PButton></p>
      <p v-else-if="!resources.length">暂时没有通过安全检查的文件，版本书目已经公开。</p>
      <article v-for="asset in resources" :key="asset.id" class="book-catalog__row">
        <strong>{{ asset.title || edition.title || work.title }}</strong><span>{{ asset.format.toUpperCase() }} · {{ asset.language }}</span>
        <PButton v-if="asset.current_revision_id" :to="resourceReaderPath(work.id, asset.id, asset.current_revision_id)">开始阅读</PButton>
        <BookResourceVersions :asset="asset" :authenticated="auth.isAuthenticated" />
      </article>
      <BookResourceUpload v-if="auth.isAuthenticated" :key="`${metadata.entity_id}:${auth.user?.uuid}`" :work-id="work.id" :edition-id="metadata.entity_id" :title="edition.title || work.title" :initial-language="edition.language" @ready="loadResources" />
      <PButton v-else variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后上传此版本的文件</PButton>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { wikiMetadata, type WikiMetadata } from '@/api/bookWiki'
import { getCatalogWork, listCatalogResources, type CatalogResource, type CatalogWork } from '@/api/bookCatalog'
import { resourceReaderPath } from '@/api/bookResources'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import BookResourceVersions from '@/components/books/BookResourceVersions.vue'
import BookCover from '@/components/books/BookCover.vue'
import PButton from '@/components/ui/PButton.vue'
import './bookCatalog.css'
import './bookPrivate.css'
const route = useRoute(), router = useRouter(), auth = useAuthStore()
const metadata = ref<WikiMetadata>(), work = ref<CatalogWork>(), resources = ref<CatalogResource[]>([]), error = ref(''), resourceError = ref(''), loading = ref(true)
const edition = computed(() => work.value?.editions.find(item => item.id === metadata.value?.entity_id))
const fields = computed(() => [
  { key: 'publisher', label: '出版社', value: edition.value?.publisher },
  { key: 'language', label: '语言', value: edition.value?.language },
  { key: 'published_date', label: '出版日期', value: edition.value?.published_date?.slice(0, 10) },
  { key: 'edition_statement', label: '版次', value: edition.value?.edition_statement },
  { key: 'isbn', label: 'ISBN', value: edition.value?.isbn13 || edition.value?.isbn10 },
  { key: 'page_count', label: '页数', value: edition.value?.page_count },
  { key: 'binding', label: '装帧', value: edition.value?.binding },
])
let generation = 0
async function load() {
  const current = ++generation
  loading.value = true; error.value = ''; resources.value = []
  try {
    const result = await wikiMetadata('edition', String(route.params.editionId))
    const parent = await getCatalogWork(String(result.fields.work_id))
    if (current !== generation) return
    if (!parent.editions.some(item => item.id === result.entity_id)) throw new Error('版本不可用')
    metadata.value = result; work.value = parent
    if (result.entity_id !== String(route.params.editionId)) { await router.replace({ path: `/books/edition/${result.entity_id}`, query: route.query }); return }
    await loadResources()
  } catch { if (current === generation) error.value = '版本不存在或暂不可用，请重试。' }
  finally { if (current === generation) loading.value = false }
}
async function loadResources() {
  if (!work.value || !metadata.value) return
  const current = generation, id = metadata.value.entity_id
  resourceError.value = ''
  try { const page = await listCatalogResources(work.value.id); if (current === generation) resources.value = page.items.filter(asset => asset.edition_id === id) }
  catch { if (current === generation) resourceError.value = '文件信息加载失败，版本书目仍然公开。' }
}
watch(() => route.params.editionId, load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
