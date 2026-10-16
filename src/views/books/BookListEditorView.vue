<template>
  <section class="booklists">
    <PButton to="/books/lists?tab=mine" variant="ghost">返回我的草稿</PButton>
    <PPageHeader :title="isNew ? '创建书单' : '编辑书单'" sub="保存草稿仅自己可见；点击公开发布后，其他人才能看到。" />
    <p v-if="loading" role="status">正在加载草稿…</p>
    <div v-else-if="loadError" role="alert"><p>{{ loadError }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
    <form v-else class="booklists__form" @submit.prevent="save(false)">
      <fieldset :disabled="busy" class="booklists__fields">
        <PInput id="list-title" v-model="draft.title" label="书单标题" required :maxlength="120" />
        <PTextarea id="list-description" v-model="draft.description" label="书单简介（选填）" :maxlength="10000" />
        <section aria-labelledby="list-items-heading">
          <h2 id="list-items-heading">图书与推荐语 <small>{{ draft.items.length }}/200</small></h2>
          <div class="booklists__toolbar">
            <PInput id="list-work-search" v-model="workQuery" label="查找图书" placeholder="输入书名或作者" @keydown.enter.prevent="searchWorks" />
            <PButton variant="secondary" :loading="searching" :disabled="!workQuery.trim()" @click="searchWorks">查找</PButton>
          </div>
          <p v-if="searchError" class="booklists__error" role="alert">{{ searchError }}</p>
          <p v-if="searched && !searching && !works.length">没有找到图书，请换个关键词。</p>
          <ul v-if="works.length" class="booklists__list" aria-label="图书搜索结果">
            <li v-for="work in works" :key="work.id" class="booklists__row">
              <span class="booklists__row-main">{{ work.title }}</span>
              <PButton variant="secondary" size="sm" :disabled="draft.items.length >= 200 || draft.items.some(item => item.work_id === work.id)" :aria-label="`添加${work.title}`" @click="add(work)">添加</PButton>
            </li>
          </ul>
          <p v-if="!draft.items.length">还没有收录图书。可先保存空草稿，发布前至少添加一本。</p>
          <ol class="booklists__list" aria-label="已收录图书">
            <li v-for="(item, index) in draft.items" :key="item.work_id" class="booklists__item">
              <p><strong>{{ index + 1 }}. {{ titles[item.work_id] || '图书信息暂不可用' }}</strong> <RouterLink :to="`/books/work/${item.work_id}`">查看图书</RouterLink></p>
              <PTextarea :id="`list-recommendation-${index}`" v-model="item.recommendation" :label="`第 ${index + 1} 本推荐语（选填）`" :maxlength="2000" />
              <div class="booklists__actions">
                <PButton variant="ghost" size="sm" :disabled="index === 0" :aria-label="`上移第${index + 1}本`" @click="move(index, -1)">上移</PButton>
                <PButton variant="ghost" size="sm" :disabled="index === draft.items.length - 1" :aria-label="`下移第${index + 1}本`" @click="move(index, 1)">下移</PButton>
                <PButton variant="ghost" size="sm" :aria-label="`移除第${index + 1}本`" @click="draft.items.splice(index, 1)">移除</PButton>
              </div>
            </li>
          </ol>
        </section>
        <p v-if="version > 0">{{ published ? (visibility === 'public' ? '已有公开发布内容；编辑草稿不会自动更新。' : '当前仅自己可见。') : '当前为未发布草稿。' }}</p>
        <p v-if="error" class="booklists__error" role="alert">{{ error }}</p>
        <PButton v-if="conflict" variant="secondary" @click="confirmAction = 'reload'">重新载入服务器草稿</PButton>
        <p v-if="notice" role="status">{{ notice }}</p>
        <div class="booklists__actions">
          <PButton type="submit" variant="secondary" :loading="busy" :disabled="!draft.title.trim() || conflict">保存私人草稿</PButton>
          <PButton :loading="busy" :disabled="!draft.title.trim() || !draft.items.length || conflict" @click="save(true)">公开发布</PButton>
          <PButton v-if="published && visibility === 'public'" variant="secondary" :disabled="conflict" @click="confirmAction = 'withdraw'">撤下公开书单</PButton>
          <PButton v-if="version > 0" variant="danger" :disabled="conflict" @click="confirmAction = 'delete'">删除书单</PButton>
        </div>
      </fieldset>
    </form>
    <PConfirm :show="!!confirmAction" :title="confirmation.title" :message="confirmation.message" :danger="confirmAction === 'delete'" :loading="busy" :error="confirmError" @confirm="confirm" @cancel="cancelConfirm" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { deleteBookList, getBookListDraft, getBookListWork, publishBookList, saveBookListDraft, searchBookListWorks, unpublishBookList, type BookListDraft, type BookListSnapshot } from '@/api/bookLists'
import type { BookPublicWork } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import './bookLists.css'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => !route.params.listId)
// 创建失败重试仍使用同一 UUID，不重复创建草稿。
const id = String(route.params.listId || crypto.randomUUID())
const draft = reactive<BookListSnapshot>({ title: '', description: '', items: [] })
const version = ref(0)
const published = ref(false)
const visibility = ref<'public' | 'private'>('private')
const baseline = ref(JSON.stringify(draft))
const dirty = computed(() => JSON.stringify(draft) !== baseline.value)
const titles = reactive<Record<string, string>>({})
const works = ref<BookPublicWork[]>([])
const workQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchError = ref('')
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const conflict = ref(false)
const confirmAction = ref<'' | 'reload' | 'withdraw' | 'delete' | 'leave'>('')
const confirmError = ref('')
let leaveResolve: ((leave: boolean) => void) | undefined
let searchSequence = 0
let alive = true
const confirmation = computed(() => ({
  reload: { title: '重新载入草稿', message: '本地尚未保存的输入会丢失。请先复制需要保留的内容，再载入服务器最新草稿。' },
  withdraw: { title: '撤下公开书单', message: '撤下后其他人无法访问，私人草稿会保留。' },
  delete: { title: '删除书单', message: '草稿与发布内容都会删除，无法恢复。' },
  leave: { title: '离开编辑', message: '还有未保存的修改，确定离开吗？' },
  '': { title: '', message: '' },
}[confirmAction.value]))

function apply(result: BookListDraft) {
  draft.title = result.title
  draft.description = result.description
  draft.items = result.items.map(item => ({ ...item }))
  version.value = result.version
  published.value = !!result.published_at
  visibility.value = result.visibility
  baseline.value = JSON.stringify(draft)
}
async function load() {
  if (isNew.value) return
  loading.value = true
  loadError.value = ''
  try {
    apply(await getBookListDraft(id))
    conflict.value = false
    error.value = ''
    // 限制并发；标题获取失败不丢失原作品 ID 和推荐语。
    const queue = [...draft.items]
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (alive && queue.length) {
        const item = queue.shift()!
        try { titles[item.work_id] = (await getBookListWork(item.work_id)).title } catch { /* 不可用作品仍保留 */ }
      }
    }))
  } catch { loadError.value = '草稿不存在、无权访问或加载失败，请重试。' }
  finally { loading.value = false }
}
function report(err: unknown) {
  conflict.value = err instanceof ApiErrorResponseError && err.status === 409
  error.value = conflict.value ? '草稿已在其他地方修改。你的输入已保留，请复制需要的内容后重新载入。' : '操作失败，请检查图书是否可用或重复，再重试。'
}
async function save(publish: boolean) {
  if (busy.value || conflict.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const saved = await saveBookListDraft(id, { title: draft.title, description: draft.description, items: draft.items.map(item => ({ ...item })), base_version: version.value })
    apply(saved)
    // 发布严格使用刚刚保存的版本；不能静默发布其他设备的新草稿。
    if (publish) apply(await publishBookList(id, saved.version, 'public'))
    notice.value = publish ? '书单已公开发布' : '私人草稿已保存，发布内容未改变'
    if (isNew.value) {
      busy.value = false
      await router.replace(`/books/lists/${id}/edit`)
    }
  } catch (err) { report(err) }
  finally { busy.value = false }
}
async function searchWorks() {
  const sequence = ++searchSequence
  searching.value = true
  searched.value = true
  searchError.value = ''
  works.value = []
  try { const result = await searchBookListWorks(workQuery.value.trim()); if (alive && sequence === searchSequence) works.value = result.items }
  catch { if (alive && sequence === searchSequence) searchError.value = '图书搜索失败，请重试。' }
  finally { if (alive && sequence === searchSequence) searching.value = false }
}
function add(work: BookPublicWork) {
  if (draft.items.length >= 200 || draft.items.some(item => item.work_id === work.id)) return
  titles[work.id] = work.title
  draft.items.push({ work_id: work.id, recommendation: '' })
}
function move(index: number, delta: number) {
  const [item] = draft.items.splice(index, 1)
  if (item) draft.items.splice(index + delta, 0, item)
}
function cancelConfirm() { confirmAction.value = ''; confirmError.value = ''; leaveResolve?.(false); leaveResolve = undefined }
async function confirm() {
  if (confirmAction.value === 'leave') { leaveResolve?.(true); leaveResolve = undefined; confirmAction.value = ''; return }
  if (confirmAction.value === 'reload') { confirmAction.value = ''; await load(); return }
  busy.value = true
  confirmError.value = ''
  try {
    if (confirmAction.value === 'delete') {
      await deleteBookList(id, version.value)
      baseline.value = JSON.stringify(draft)
      confirmAction.value = ''
      busy.value = false
      await router.replace('/books/lists?tab=mine')
    } else {
      const result = await unpublishBookList(id, version.value)
      version.value = result.version
      visibility.value = 'private'
      notice.value = '书单已撤下，草稿已保留'
      confirmAction.value = ''
    }
  } catch (err) { report(err); confirmError.value = error.value }
  finally { busy.value = false }
}
onBeforeRouteLeave(() => {
  if (busy.value) return false
  if (!dirty.value) return true
  confirmAction.value = 'leave'
  return new Promise<boolean>(resolve => { leaveResolve = resolve })
})
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); void load() })
onBeforeUnmount(() => { alive = false; window.removeEventListener('beforeunload', beforeUnload); leaveResolve?.(false) })
</script>

<style scoped>
.booklists__fields { border: 0; padding: 0; margin: 0; display: grid; gap: 1.5rem; min-width: 0; }
</style>
