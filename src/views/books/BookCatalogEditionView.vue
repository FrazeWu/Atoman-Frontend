<template>
  <section class="book-catalog private-books">
    <p v-if="loading" role="status" class="book-catalog__status-text">正在加载版本…</p>
    <div v-else-if="error" role="alert" class="book-catalog__error-box">
      <p class="book-catalog__error">{{ error }}</p>
      <PButton variant="secondary" @click="load">重新加载版本</PButton>
    </div>
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
          <PPageHeader
            :title="edition.title || work.title"
            :sub="`${work.authors.map(person => person.name).join(' / ')} 著${edition.translators?.length ? ` · ${edition.translators.map(person => person.name).join(' / ')} 译` : ''}`"
          />
          <p v-if="edition.subtitle" class="book-catalog__work-subtitle">{{ edition.subtitle }}</p>
          <p class="book-catalog__edition-parent-link">
            <RouterLink :to="`/books/work/${work.id}`">所属作品：{{ work.title }}</RouterLink>
          </p>
          <dl class="book-catalog__details-dl">
            <template v-for="field in fields" :key="field.key">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value || '待补充' }}</dd>
            </template>
          </dl>
          <div class="book-catalog__hero-actions">
            <BookWikiPanel kind="edition" :entity-id="metadata.entity_id" :work-id="work.id" :authenticated="auth.isAuthenticated" @changed="load" />
          </div>
        </div>
      </div>

      <section class="book-catalog__section">
        <div class="book-catalog__section-header">
          <h2>版本电子文件</h2>
        </div>
        <div v-if="resourceError" role="alert" class="book-catalog__error-box">
          <p class="book-catalog__error">{{ resourceError }}</p>
          <PButton variant="secondary" @click="loadResources">重试加载文件</PButton>
        </div>
        <p v-else-if="!resources.length" class="book-catalog__empty-hint">暂时没有通过安全检查的文件，版本书目已经公开。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="asset in resources" :key="asset.id" class="book-catalog__row">
            <strong>{{ asset.title || edition.title || work.title }}</strong>
            <span>{{ asset.format.toUpperCase() }} · {{ asset.language }}</span>
            <PButton v-if="asset.current_revision_id" size="sm" :to="resourceReaderPath(work.id, asset.id, asset.current_revision_id)">开始阅读</PButton>
            <BookResourceVersions :asset="asset" :authenticated="auth.isAuthenticated" />
          </li>
        </ul>

        <div class="book-catalog__upload-actions">
          <BookResourceUpload
            v-if="auth.isAuthenticated"
            :key="`${metadata.entity_id}:${auth.user?.uuid}`"
            :work-id="work.id"
            :edition-id="metadata.entity_id"
            :title="edition.title || work.title"
            :initial-language="edition.language"
            @ready="loadResources"
          />
          <PButton v-else variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">
            登录后上传此版本的文件
          </PButton>
        </div>
      </section>
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
import PPageHeader from '@/components/ui/PPageHeader.vue'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const metadata = ref<WikiMetadata>()
const work = ref<CatalogWork>()
const resources = ref<CatalogResource[]>([])
const error = ref('')
const resourceError = ref('')
const loading = ref(true)

const edition = computed(() => work.value?.editions.find(item => item.id === metadata.value?.entity_id))
const fields = computed(() => [
  { key: 'publisher', label: '出版社', value: edition.value?.publisher },
  { key: 'language', label: '语言', value: edition.value?.language },
  { key: 'published_date', label: '出版日期', value: edition.value?.published_date?.slice(0, 10) },
  { key: 'edition_statement', label: '版次', value: edition.value?.edition_statement },
  { key: 'isbn', label: 'ISBN', value: edition.value?.isbn13 || edition.value?.isbn10 },
  { key: 'page_count', label: '页数', value: edition.value?.page_count ? `${edition.value?.page_count} 页` : undefined },
  { key: 'binding', label: '装帧', value: edition.value?.binding },
])

let generation = 0

async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  resources.value = []
  try {
    const meta = await wikiMetadata('edition', String(route.params.editionId || ''))
    if (current !== generation) return
    metadata.value = meta
    const parentWork = await getCatalogWork(String(meta.fields.work_id))
    if (current !== generation) return
    work.value = parentWork
    loading.value = false
    void loadResources()
  } catch {
    if (current !== generation) return
    loading.value = false
    error.value = '版本加载失败，请检查网络后重试。'
  }
}

async function loadResources() {
  if (!work.value || !edition.value) return
  resourceError.value = ''
  try {
    const all = await listCatalogResources(work.value.id)
    resources.value = all.items.filter(item => item.edition_id === edition.value?.id)
  } catch {
    resourceError.value = '加载此版本文件失败，请重试。'
  }
}

watch(
  () => route.params.editionId,
  () => {
    void load()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  generation++
})
</script>

<style scoped>
.book-catalog__status-text {
  font-size: 0.875rem;
  color: var(--a-color-text-secondary, #64748b);
  padding: 1.5rem 0;
}

.book-catalog__error-box {
  padding: 1.5rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background: #ffffff;
}

.book-catalog__upload-actions {
  margin-top: 1.5rem;
}
</style>
