<template>
  <section class="revision-reader">
    <p v-if="loading" role="status">正在打开文件版本…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton><PButton :to="`/books/work/${route.params.workId}`" variant="ghost">返回图书</PButton></div>
    <template v-else-if="source">
      <div class="revision-reader__status"><span>文件版本 {{ version }} · 进度与书签暂保存在本机</span><PButton variant="ghost" @click="load">重新载入文件</PButton></div>
      <BookPublicReaderView :key="source.progressKey" :source="source" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getCatalogWork, listCatalogResources } from '@/api/bookCatalog'
import { fetchResourceRevision, listResourceRevisions } from '@/api/bookResources'
import type { BookReaderSource } from '@/types/bookReaderSource'
import BookPublicReaderView from './BookPublicReaderView.vue'
import PButton from '@/components/ui/PButton.vue'

const route = useRoute()
const auth = useAuthStore()
const owner = computed(() => auth.isAuthenticated ? auth.user?.uuid || 'guest' : 'guest')
const sessionReady = ref(auth.isAuthenticated)
const source = shallowRef<BookReaderSource | null>(null)
const version = ref(0)
const loading = ref(true)
const error = ref('')
let generation = 0
let controller: AbortController | undefined
async function load() {
  const current = ++generation
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  source.value = null
  loading.value = true
  error.value = ''
  try {
    const work = await getCatalogWork(String(route.params.workId))
    const resources = await listCatalogResources(work.id)
    const asset = resources.items.find(item => item.id === String(route.params.assetId))
    if (!asset) throw new Error('该电子书不属于这本图书，或已不可用。')
    const revisions = await listResourceRevisions(asset.id)
    const revision = revisions.items.find(item => item.id === String(route.params.revisionId) && item.asset_id === asset.id)
    if (!revision) throw new Error('指定文件版本不可读。不会自动切换到其他版本，请返回图书详情选择文件。')
    if (current !== generation) return
    version.value = revision.number
    source.value = {
      title: work.title,
      backTo: `/books/work/${work.id}`,
      progressKey: `revision:${owner.value}:${revision.id}`,
      asset: { id: asset.id, work_id: work.id, title: work.title, author: work.authors.map(person => person.name).join(' / '), format: asset.format, file_name: revision.original_filename, content_type: '', size: 0, status: 'published', created_at: revision.created_at },
      loadContent: () => fetchResourceRevision(revision.id, signal),
    }
  } catch (err) { if (current === generation) error.value = err instanceof Error ? err.message : '文件版本加载失败，请重试。' }
  finally { if (current === generation) loading.value = false }
}
watch([() => route.params.workId, () => route.params.assetId, () => route.params.revisionId, owner, sessionReady], () => { if (sessionReady.value) void load() }, { immediate: true })
onMounted(async () => { if (!sessionReady.value) { await auth.restoreSession(); sessionReady.value = true } })
onBeforeUnmount(() => { generation++; controller?.abort() })
</script>

<style scoped>
.revision-reader { min-width: 0; }
.revision-reader__status { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem; color: var(--a-color-muted-soft); }
</style>
