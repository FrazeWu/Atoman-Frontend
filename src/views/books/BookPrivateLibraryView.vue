<template>
  <section class="book-catalog file-library">
    <PPageHeader title="我的书架" sub="每一本具体电子书独立保存阅读进度。归档和历史文件仍会显示。" />
    <div class="file-library__toolbar">
      <label>
        <span>阅读状态</span>
        <select v-model="status" @change="load">
          <option value="">全部</option>
          <option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
      <label>
        <span>归档筛选</span>
        <select v-model="archiveFilter">
          <option value="all">全部（包括已归档）</option>
          <option value="active">未归档</option>
          <option value="archived">已归档</option>
        </select>
      </label>
      <label>
        <span>排序</span>
        <select v-model="sort" @change="load">
          <option value="activity">最近活动</option>
          <option value="added">最近加入</option>
          <option value="progress">最远阅读进度</option>
          <option value="title">书名</option>
        </select>
      </label>
      <label class="file-library__search">
        <span>搜索</span>
        <input v-model.trim="query" placeholder="搜索书名" />
      </label>
      <PButton size="sm" to="/books">发现图书</PButton>
    </div>
    <p v-if="error" role="alert" class="book-catalog__error">
      {{ error }} <PButton size="sm" variant="secondary" @click="load">重试</PButton>
    </p>
    <p v-if="loading" role="status">正在加载书架…</p>
    <template v-else>
      <p class="file-library__count">{{ visible.length }} 本图书 · 含历史文件及已归档图书</p>
      <PEmpty v-if="!visible.length" description="这里还没有符合条件的具体电子书。可以进入出版版本页面添加。" />
      <ul v-else class="file-library__grid">
        <li v-for="entry in visible" :key="entry.revision_id" class="file-library__card">
          <button type="button" class="file-library__cover" :disabled="!entry.file_available" :aria-label="'阅读 ' + entry.title" @click="read(entry)">
            <BookCover variant="edition" :src="entry.cover_url" :title="entry.title" :category="entry.format.toUpperCase()" />
          </button>
          <div class="file-library__body">
            <button type="button" class="file-library__title" :disabled="!entry.file_available" @click="read(entry)">{{ entry.title }}</button>
            <div class="file-library__meta">{{ entry.format.toUpperCase() }} · {{ labelForStatus(entry.status) }}</div>
            <div class="file-library__flags">
              <span v-if="entry.archived">已归档</span>
              <span v-if="entry.has_better">有更优版本</span>
              <span v-if="!entry.file_available">文件暂不可用</span>
            </div>
            <div class="file-library__progress" role="progressbar" :aria-valuenow="Math.round(entry.furthest_percent * 100)" aria-valuemin="0" aria-valuemax="100">
              <div :style="{ width: String(Math.round(entry.furthest_percent * 100)) + '%' }"></div>
            </div>
            <small>最远阅读 {{ Math.round(entry.furthest_percent * 100) }}%</small>
            <PButton block size="sm" :disabled="!entry.file_available" @click="read(entry)">继续阅读</PButton>
            <div class="file-library__tools">
              <PButton v-if="entry.has_better && entry.edition_id" size="sm" variant="ghost" :to="'/books/edition/' + entry.edition_id">查看更优版本</PButton>
              <details>
                <summary>管理</summary>
                <label>阅读状态
                  <select :value="entry.status" :disabled="!!busy" @change="update(entry, { status: ($event.target as HTMLSelectElement).value as FileShelfStatus })">
                    <option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                </label>
                <button type="button" :disabled="!!busy" @click="update(entry, { archived: !entry.archived })">{{ entry.archived ? '取消归档' : '归档' }}</button>
                <button type="button" :disabled="!!busy" @click="removing = entry">移出书架</button>
              </details>
            </div>
          </div>
        </li>
      </ul>
      <PButton v-if="entries.length < total" size="sm" variant="secondary" :disabled="!!busy" @click="more">加载更多</PButton>
    </template>
    <PConfirm
      :show="!!removing"
      title="移出这本具体图书？"
      message="只移出书架，不删除文件、阅读进度、划线和笔记。"
      @confirm="remove"
      @cancel="removing = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import BookCover from '@/components/books/BookCover.vue'
import { listFileShelf, saveFileShelf, removeFileShelf, type FileShelfStatus, type FileShelfSort, type FileShelfItem } from '@/api/bookFileShelf'
import { resourceReaderPath } from '@/api/bookResources'
import './bookCatalog.css'

const router = useRouter()
const shelfStatuses: { value: FileShelfStatus; label: string }[] = [
  { value: 'unstarted', label: '未开始' },
  { value: 'reading', label: '在读' },
  { value: 'finished', label: '已读' },
  { value: 'paused', label: '暂停' },
]
const entries = ref<FileShelfItem[]>([])
const total = ref(0)
const status = ref('')
const archiveFilter = ref('all')
const sort = ref<FileShelfSort>('activity')
const query = ref('')
const loading = ref(true)
const busy = ref('')
const error = ref('')
const removing = ref<FileShelfItem | null>(null)
const visible = computed(() => entries.value.filter(e =>
  (archiveFilter.value === 'all' || (archiveFilter.value === 'archived' ? e.archived : !e.archived)) &&
  (!query.value || e.title.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()))
))
const labelForStatus = (s: FileShelfStatus) => shelfStatuses.find(x => x.value === s)?.label ?? s

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listFileShelf({ sort: sort.value, status: status.value })
    entries.value = result.items
    total.value = result.total
  } catch { error.value = '加载书架失败，请重试。' }
  finally { loading.value = false }
}
async function more() {
  if (busy.value) return
  busy.value = 'more'
  try {
    const result = await listFileShelf({ sort: sort.value, status: status.value, offset: entries.value.length })
    entries.value.push(...result.items)
    total.value = result.total
  } catch { error.value = '加载更多失败。' }
  finally { busy.value = '' }
}
function read(entry: FileShelfItem) {
  if (!entry.file_available) return
  void router.push(resourceReaderPath(entry.work_id, entry.asset_id, entry.revision_id))
}
async function update(entry: FileShelfItem, patch: { status?: FileShelfStatus; archived?: boolean }) {
  busy.value = entry.id
  try { await saveFileShelf(entry.revision_id, patch); await load() }
  catch { error.value = '更新书架失败，请重试。' }
  finally { busy.value = '' }
}
async function remove() {
  if (!removing.value) return
  busy.value = removing.value.id
  try { await removeFileShelf(removing.value.revision_id); removing.value = null; await load() }
  catch { error.value = '移出书架失败。' }
  finally { busy.value = '' }
}
onMounted(load)
</script>

<style scoped>
.file-library { display: grid; gap: 1.1rem; }
.file-library__toolbar { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; }
.file-library__toolbar label { display: grid; gap: .3rem; font-size: .8rem; color: var(--a-color-text-secondary); }
.file-library__toolbar select,.file-library__toolbar input { background: var(--a-color-bg); color: var(--a-color-text-primary); border: 1px solid var(--a-color-border-soft); border-radius: .4rem; padding: .55rem; min-height: 2.35rem; }
.file-library__search { flex: 1; min-width: 160px; }
.file-library__count { font-size: .8rem; color: var(--a-color-text-secondary); }
.file-library__grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(185px,1fr)); padding: 0; list-style: none; gap: 1.2rem; }
.file-library__card { border: 1px solid var(--a-color-border-soft); border-radius: .65rem; padding: .8rem; min-width: 0; display: grid; gap: .65rem; align-content: start; }
.file-library__cover { width: 100%; padding: 0; border: 0; background: none; cursor: pointer; aspect-ratio: 3/4; overflow: hidden; }
.file-library__cover:disabled { cursor: default; opacity: .7; }
.file-library__body { display: grid; align-content: start; gap: .45rem; }
.file-library__title { font-weight: 600; font-size: .95rem; text-align: left; background: none; border: none; padding: 0; color: inherit; cursor: pointer; }
.file-library__meta,.file-library__body small { color: var(--a-color-text-secondary); font-size: .75rem; }
.file-library__flags { display: flex; flex-wrap: wrap; gap: .3rem; font-size: .7rem; color: var(--a-color-text-secondary); }
.file-library__flags span { background: var(--a-color-bg-soft,var(--a-color-bg)); border: 1px solid var(--a-color-border-soft); border-radius: .3rem; padding: .1rem .35rem; }
.file-library__progress { height: .3rem; background: var(--a-color-border-soft); border-radius: 1rem; overflow: hidden; }
.file-library__progress div { height: 100%; background: var(--a-color-primary,var(--a-color-text-primary)); }
.file-library__tools { display: flex; justify-content: space-between; align-items: start; gap: .35rem; }
.file-library__tools details { margin-left: auto; position: relative; font-size: .8rem; }
.file-library__tools summary { cursor: pointer; }
.file-library__tools details[open] { z-index: 2; }
.file-library__tools details label { display: grid; gap: .3rem; }
.file-library__tools details button { display: block; margin-top: .55rem; background: transparent; border: 0; color: inherit; cursor: pointer; padding: .2rem 0; }
</style>
