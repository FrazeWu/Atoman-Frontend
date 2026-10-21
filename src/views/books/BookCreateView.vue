<template>
  <section class="book-catalog">
    <PPageHeader
      title="添加图书"
      sub="录入至全站公共书库：先确认作品实体，再确认具体出版版本与阅读文件。"
    />
    <ol class="book-catalog__steps" aria-label="添加进度">
      <li
        v-for="(label, index) in ['确认作品', '确认版本／译本', '关联文件与阅读']"
        :key="label"
        class="book-catalog__step-item"
        :aria-current="step === index + 1 ? 'step' : undefined"
      >
        {{ index + 1 }} · {{ label }}
      </li>
    </ol>
    <form v-if="step === 1" class="book-catalog__form" @submit.prevent="next">
      <fieldset class="book-catalog__fields" :disabled="busy">
        <!-- 电子文件选择区域 -->
        <div class="book-catalog__file-zone">
          <label for="create-source-file" class="book-catalog__file-label">
            选择电子文件（可选，也可以只填写书目）
          </label>
          <input
            id="create-source-file"
            type="file"
            class="book-catalog__file-input"
            accept=".epub,.pdf,.txt,.cbz,.cbr"
            @change="chooseFile"
          />
          <p v-if="file" class="book-catalog__file-info">
            {{ file.name }} · 文件暂存在本页，确认版本并同意公开分享后才上传。此步骤不会进行 OCR。
          </p>
        </div>

        <!-- 查找已有作品 -->
        <div class="book-catalog__search-row">
          <PInput
            id="create-work-search"
            v-model="query"
            label="查找已有作品"
            placeholder="输入书名或作者"
            @keyup.enter="findWorks"
          />
          <PButton
            type="button"
            variant="secondary"
            :disabled="searching"
            @click="findWorks"
          >
            {{ searching ? '正在查找…' : '查找作品' }}
          </PButton>
        </div>

        <p v-if="searched && !matches.length && !searchError" role="status" class="book-catalog__empty-hint">
          没有找到匹配作品，可以选择新建。
        </p>
        <p v-if="searchError" role="alert" class="book-catalog__error">
          {{ searchError }}
        </p>

        <!-- 匹配作品与新建选项列表 -->
        <div class="book-catalog__choices-container">
          <label
            v-for="work in matches"
            :key="work.id"
            class="book-catalog__choice"
          >
            <input
              v-model="workChoice"
              type="radio"
              name="work"
              :value="work.id"
            />
            <div class="book-catalog__choice-body">
              <span class="book-catalog__choice-title">{{ work.title }}</span>
              <small>{{ work.authors.map(person => person.name).join(' / ') }} · {{ work.editions.length }} 个版本</small>
            </div>
          </label>

          <label class="book-catalog__choice">
            <input
              v-model="workChoice"
              type="radio"
              name="work"
              value="new"
            />
            <div class="book-catalog__choice-body">
              <span class="book-catalog__choice-title">新建作品（不是新增出版版本）</span>
              <small>公共书库尚未收录此作品实体，建立全新作品后可为其添加具体出版版本。</small>
            </div>
          </label>
        </div>

        <!-- 新建作品表单卡片 -->
        <div v-if="workChoice === 'new'" class="book-catalog__new-work-card">
          <PInput
            id="create-book-title"
            v-model="title"
            label="作品书名"
            required
            :maxlength="200"
            placeholder="例如 沉思录、代码整洁之道"
          />
          <PTextarea
            id="create-book-authors"
            v-model="authors"
            label="作者"
            hint="每行一位新作者，也可以选择已有作者。译者在下一步填写。"
            :required="!selectedAuthors.length"
            :rows="3"
            placeholder="例如 马可·奥勒留"
          />
          <details class="book-catalog__people-picker">
            <summary class="book-catalog__people-summary">选择已有作者</summary>
            <div class="book-catalog__people-content">
              <div class="book-catalog__people-search-row">
                <PInput
                  id="create-person-search"
                  v-model="personQuery"
                  label="作者姓名"
                  placeholder="搜索作者库"
                  @keyup.enter="findPeople"
                />
                <PButton
                  type="button"
                  variant="secondary"
                  @click="findPeople"
                >
                  搜索已有作者
                </PButton>
              </div>
              <div v-if="availablePeople.length > 0" class="book-catalog__people-list">
                <label
                  v-for="person in availablePeople"
                  :key="person.id"
                  class="book-catalog__person-chip"
                >
                  <input
                    v-model="selectedAuthors"
                    type="checkbox"
                    :value="person.id"
                  />
                  <span>{{ person.name }}</span>
                </label>
              </div>
            </div>
          </details>
          <PInput
            id="create-book-original"
            v-model="originalTitle"
            label="原作名（选填）"
            placeholder="例如 Meditations、Clean Code"
          />
          <PTextarea
            id="create-book-description"
            v-model="description"
            label="作品简介（选填）"
            placeholder="关于这部作品的核心主旨、写作背景或作者思想概述..."
            :rows="4"
          />
        </div>
      </fieldset>
      <div class="book-catalog__actions">
        <PButton type="submit" :disabled="!canContinue || busy">下一步：版本／译本</PButton>
        <PButton
          v-if="workChoice === 'new' && !file"
          type="button"
          variant="secondary"
          :disabled="!canContinue || busy"
          @click="save(false)"
        >
          仅创建并公开作品
        </PButton>
      </div>
    </form>
    <form v-else-if="step === 2" class="book-catalog__form" @submit.prevent="save(true)">
      <p>所属作品：<strong>{{ selectedWork?.title || title }}</strong> · {{ selectedWork?.authors.map(person => person.name).join(' / ') || authors }}</p>
      <p>同一作品的不同出版版本、语言和译者都放在这里。请选择已有版本，或明确新建。</p>
      <fieldset class="book-catalog__fields" :disabled="busy">
        <PInput v-if="selectedWork?.editions.length" id="create-edition-search" v-model="editionQuery" label="查找此作品的版本" placeholder="ISBN、译者、出版社或语言" />
        <p v-if="selectedWork?.editions.length && !matchingEditions.length">没有找到符合条件的版本，可修改关键词或新建版本。</p>
        <label v-for="edition in matchingEditions" :key="edition.id" class="book-catalog__choice"><input v-model="editionChoice" type="radio" name="edition" :value="edition.id" /><span>{{ edition.title || selectedWork?.title }}<small>{{ editionSummary(edition) }}</small></span></label>
        <label class="book-catalog__choice"><input v-model="editionChoice" type="radio" name="edition" value="new" /> 新建版本／译本</label>
        <template v-if="editionChoice === 'new'">
          <PInput id="create-edition-title" v-model="editionTitle" label="版本书名（选填）" :placeholder="selectedWork?.title || title" />
          <PInput id="create-edition-subtitle" v-model="subtitle" label="版本副标题（选填）" />
          <PTextarea id="create-edition-translators" v-model="translators" label="译者（选填，每行一位）" :rows="2" />
          <PInput id="create-edition-language" v-model="language" label="版本语言代码（选填）" placeholder="例如 zh 或 en" />
          <PInput id="create-edition-publisher" v-model="publisher" label="出版社（选填）" />
          <label>出版日期（选填，完整日期）<PMaskedDateInput v-model="publishedDate" /></label>
          <PInput id="create-edition-statement" v-model="statement" label="版次（选填）" placeholder="例如 第 2 版、修订版" />
          <PInput id="create-edition-isbn" v-model="isbn" label="ISBN（选填）" />
          <PInput id="create-edition-pages" v-model="pages" label="页数（选填）" type="number" min="1" step="1" />
          <PInput id="create-edition-cover" v-model="cover" label="封面图片地址（选填）" type="url" />
        </template>
        <dl v-else-if="chosenEdition"><dt>已选择版本（不会修改已有资料）</dt><dd>{{ editionSummary(chosenEdition) }}</dd></dl>
      </fieldset>
      <p v-if="createdId" role="status">作品已保存。请重试保存版本，不会重复创建作品。</p>
      <div class="book-catalog__actions">
        <PButton v-if="!createdId" type="button" variant="secondary" :disabled="busy" @click="step = 1">返回作品</PButton>
        <PButton type="submit" :disabled="!editionChoice || busy">{{ busy ? '正在保存…' : editionChoice === 'new' ? '确认并公开版本' : '确认使用此版本' }}</PButton>
      </div>
    </form>
    <section v-else-if="createdId && editionId">
      <h2>书目已公开</h2><p>{{ selectedWork?.title || title }} → {{ savedEditionTitle }}</p>
      <PButton :to="`/books/edition/${editionId}`">查看版本详情</PButton>
      <BookResourceUpload :key="editionId" :work-id="createdId" :edition-id="editionId" :title="savedEditionTitle" :initial-file="file" :initial-language="savedLanguage" @ready="file = null" />
    </section>
    <p v-if="error" class="book-catalog__error" role="alert">{{ error }}</p>
    <PConfirm :show="leaveOpen" title="离开创建" message="未保存的信息和未上传的本地文件不会保留，确定离开吗？" @confirm="resolveLeave(true)" @cancel="resolveLeave(false)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { createCatalogEdition, createCatalogWork, getCatalogWork, searchCatalogWorks, type CatalogWork } from '@/api/bookCatalog'
import type { BookPublicEdition, BookPublicWork } from '@/api/books'
import { searchWikiPeople } from '@/api/bookWiki'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import './bookCatalog.css'

const router = useRouter(), route = useRoute()
const step = ref(1), workChoice = ref(''), editionChoice = ref('')
const editionQuery = ref('')
const query = ref(''), matches = ref<BookPublicWork[]>([]), searched = ref(false), searching = ref(false), searchError = ref('')
const selectedWork = ref<CatalogWork | null>(null), file = ref<File | null>(null)
const title = ref(''), authors = ref(''), originalTitle = ref(''), description = ref('')
const personQuery = ref(''), selectedAuthors = ref<string[]>([]), availablePeople = ref<{ id: string; name: string }[]>([])
const editionTitle = ref(''), subtitle = ref(''), translators = ref(''), language = ref(''), publisher = ref(''), statement = ref(''), isbn = ref(''), pages = ref(''), cover = ref('')
const publishedDate = ref({ year: '', month: '', day: '' })
const busy = ref(false), error = ref(''), createdId = ref(''), editionId = ref(''), finished = ref(false), leaveOpen = ref(false)
const savedEditionTitle = ref(''), savedLanguage = ref('')
let leaveResolve: ((leave: boolean) => void) | undefined
let alive = true, searchController: AbortController | undefined
const names = (value: string) => [...new Set(value.split('\n').map(name => name.trim()).filter(Boolean))]
const canContinue = computed(() => !!workChoice.value && (workChoice.value !== 'new' || (!!title.value.trim() && (names(authors.value).length > 0 || selectedAuthors.value.length > 0))))
const chosenEdition = computed(() => selectedWork.value?.editions.find(edition => edition.id === editionChoice.value))
const matchText = (value: string) => value.replace(/[\s-]/g, '').toLowerCase()
const matchingEditions = computed(() => (selectedWork.value?.editions || []).filter(edition => matchText(`${edition.title || ''} ${editionSummary(edition)}`).includes(matchText(editionQuery.value))))
const dirty = computed(() => !finished.value && (!!workChoice.value || !!file.value || [title, authors, query].some(value => !!value.value)))
watch(workChoice, () => { selectedWork.value = null; editionChoice.value = ''; editionQuery.value = ''; error.value = '' })
function editionSummary(edition: BookPublicEdition) { return [edition.subtitle, edition.translators?.map(person => person.name).join(' / '), edition.language, edition.publisher, edition.published_date?.slice(0, 10), edition.edition_statement, edition.isbn13 || edition.isbn10].filter(Boolean).join(' · ') || '版本资料待补充' }
async function findWorks() {
  searchController?.abort(); searchController = new AbortController()
  const controller = searchController
  searching.value = true; searchError.value = ''
  try { const page = await searchCatalogWorks(query.value.trim(), 24, 0, controller.signal); if (alive && !controller.signal.aborted) { matches.value = page.items; searched.value = true } }
  catch { if (alive && !controller.signal.aborted) searchError.value = '作品查找失败，请重试。' }
  finally { if (alive && controller === searchController) searching.value = false }
}
async function findPeople() { try { const page = await searchWikiPeople(personQuery.value); if (alive) availablePeople.value = [...availablePeople.value.filter(person => selectedAuthors.value.includes(person.id)), ...page.items.filter(person => !selectedAuthors.value.includes(person.id))] } catch { if (alive) error.value = '作者搜索失败，请重试。' } }
function chooseFile(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  if (!/\.(epub|pdf|txt|cbz|cbr)$/i.test(selected.name) || !selected.size) { error.value = '请选择非空的 EPUB、PDF、TXT、CBZ 或 CBR 文件。'; return }
  file.value = selected; error.value = ''
}
async function next() {
  if (busy.value || !canContinue.value) return
  busy.value = true; error.value = ''
  try { if (workChoice.value !== 'new') selectedWork.value = await getCatalogWork(workChoice.value); if (alive) step.value = 2 }
  catch { if (alive) error.value = '作品详情加载失败，请重试。' }
  finally { if (alive) busy.value = false }
}
async function save(withEdition: boolean) {
  if (busy.value || !canContinue.value || (withEdition && !editionChoice.value)) return
  const normalizedISBN = isbn.value.replace(/[\s-]/g, '').toUpperCase()
  const newEdition = withEdition && editionChoice.value === 'new'
  if (newEdition && normalizedISBN && !/^(\d{9}[\dX]|\d{13})$/.test(normalizedISBN)) { error.value = 'ISBN 请输入 10 位或 13 位编号。'; return }
  if (newEdition && pages.value && (!Number.isInteger(Number(pages.value)) || Number(pages.value) < 1)) { error.value = '页数请输入正整数。'; return }
  const date = publishedDate.value
  const dateString = [date.year, date.month, date.day].join('-')
  if (newEdition && [date.year, date.month, date.day].some(Boolean) && (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || Number.isNaN(Date.parse(dateString)) || new Date(dateString).toISOString().slice(0, 10) !== dateString)) { error.value = '请填写完整有效的出版日期，或留空。'; return }
  busy.value = true; error.value = ''
  try {
    // 保存过的作品 ID 始终复用，后续失败不重建上一步。
    if (!createdId.value) createdId.value = selectedWork.value?.id || (await createCatalogWork({ title: title.value.trim(), authors: names(authors.value), author_ids: selectedAuthors.value, original_title: originalTitle.value.trim(), description: description.value.trim() })).id
    if (!createdId.value) throw new Error('缺少作品 ID')
    if (!withEdition) { finished.value = true; busy.value = false; await router.replace({ path: `/books/work/${createdId.value}`, query: route.query }); return }
    const edition = newEdition ? await createCatalogEdition(createdId.value, { title: editionTitle.value.trim(), subtitle: subtitle.value.trim(), translators: names(translators.value), language: language.value.trim(), publisher: publisher.value.trim(), edition_statement: statement.value.trim(), isbn10: normalizedISBN.length === 10 ? normalizedISBN : '', isbn13: normalizedISBN.length === 13 ? normalizedISBN : '', published_date: date.year ? dateString : '', page_count: Number(pages.value || 0), cover_url: cover.value.trim() }) : chosenEdition.value
    if (!edition?.id) throw new Error('缺少版本 ID')
    editionId.value = edition.id; savedEditionTitle.value = edition.title || selectedWork.value?.title || title.value; savedLanguage.value = edition.language || ''; step.value = 3; finished.value = true
  } catch { error.value = createdId.value ? '作品已保存，版本保存失败。输入仍保留，请重试，不会重复创建作品。' : '创建结果未确认。请先查找是否已创建，避免重复。' }
  finally { if (alive) busy.value = false }
}
function resolveLeave(leave: boolean) { leaveOpen.value = false; leaveResolve?.(leave); leaveResolve = undefined }
onBeforeRouteLeave(() => { if (busy.value) return false; if (!dirty.value) return true; leaveOpen.value = true; return new Promise<boolean>(resolve => { leaveResolve = resolve }) })
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => { window.addEventListener('beforeunload', beforeUnload); if (typeof route.query.work === 'string') { workChoice.value = route.query.work; await next() } })
onBeforeUnmount(() => { alive = false; searchController?.abort(); window.removeEventListener('beforeunload', beforeUnload); leaveResolve?.(false) })
</script>
