<template>
  <section class="book-catalog">
    <PPageHeader
      title="添加图书"
      sub="先确认作品，再确认具体出版版本与阅读文件。"
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
        <!-- 输入书名即查找，选择结果或直接创建未收录的作品。 -->
        <div ref="workSearchRoot" class="book-create__combobox" @focusout="onWorkFocusOut">
          <PInput
            id="create-book-title"
            v-model="query"
            label="书名"
            placeholder="输入书名，搜索已有作品"
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="book-create-work-results"
            :aria-expanded="workListOpen"
            @focus="workListOpen = true"
            @keydown.esc="workListOpen = false"
            @keydown.enter.prevent="confirmWorkInput"
          />
          <div v-if="workListOpen && query.trim()" id="book-create-work-results" class="book-create__suggestions" role="listbox" aria-label="作品搜索结果">
            <p v-if="searching" class="book-create__suggestions-status" role="status">正在查找作品…</p>
            <template v-else>
              <button
                v-for="work in matches"
                :key="work.id"
                type="button"
                class="book-create__suggestion"
                role="option"
                :aria-selected="workChoice === work.id"
                @click="selectExistingWork(work)"
              >
                <span class="book-create__suggestion-title">{{ work.title }}</span>
                <small>{{ work.authors.map(person => person.name).join(' / ') || '作者待补充' }} · {{ work.editions.length }} 个版本</small>
              </button>
              <button
                v-if="canSuggestNewWork"
                type="button"
                class="book-create__suggestion book-create__suggestion--create"
                role="option"
                :aria-selected="workChoice === 'new'"
                @click="selectNewWork"
              >
                <span class="book-create__suggestion-title">{{ hasExactWorkMatch ? '仍新建同名作品' : `＋ 新建《${query.trim()}》` }}</span>
                <small>{{ hasExactWorkMatch ? '仅当这是不同作品时使用；保存时会再次查重' : '没有完全相同的作品，创建后再添加出版版本' }}</small>
              </button>
              <p v-else-if="searched && !matches.length && !searchError" class="book-create__suggestions-status">暂无搜索结果</p>
            </template>
            <button v-if="searchError" type="button" class="book-create__suggestion" @click="findWorks">搜索失败，点击重试</button>
          </div>
        </div>
        <p v-if="workChoice && workChoice !== 'new'" class="book-create__selected-hint" role="status">
          已选择已有作品：{{ matches.find(work => work.id === workChoice)?.title || selectedWork?.title || '已有作品' }}
          <button type="button" class="book-create__text-action" @click="workListOpen = true">更换作品</button>
        </p>

        <div v-if="workChoice === 'new'" class="book-catalog__new-work-card">
          <div ref="personSearchRoot" class="book-create__combobox" @focusout="onPersonFocusOut">
            <PInput
              id="create-person-search"
              v-model="personQuery"
              label="作者"
              hint="逐个输入并添加作者，可选择已有作者或新建。译者在下一步填写。"
              placeholder="输入作者姓名，自动搜索"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="book-create-person-results"
              :aria-expanded="personListOpen"
              @focus="personListOpen = true"
              @keydown.esc="personListOpen = false"
              @keydown.enter.prevent="confirmPersonInput"
            />
            <div v-if="personListOpen && personQuery.trim()" id="book-create-person-results" class="book-create__suggestions" role="listbox" aria-label="作者搜索结果">
              <p v-if="personSearching" class="book-create__suggestions-status" role="status">正在查找作者…</p>
              <template v-else>
                <button
                  v-for="person in availablePeople"
                  :key="person.id"
                  type="button"
                  class="book-create__suggestion"
                  role="option"
                  :aria-selected="selectedAuthors.includes(person.id)"
                  :disabled="selectedAuthors.includes(person.id)"
                  @click="addExistingAuthor(person)"
                >
                  <span class="book-create__suggestion-title">{{ person.name }}</span>
                  <small>{{ selectedAuthors.includes(person.id) ? '已添加' : '选择已有作者' }}</small>
                </button>
                <button
                  v-if="canSuggestNewAuthor"
                  type="button"
                  class="book-create__suggestion book-create__suggestion--create"
                  role="option"
                  aria-selected="false"
                  @click="addNewAuthor"
                >
                  <span class="book-create__suggestion-title">{{ hasExactAuthorMatch ? '仍新建同名作者' : `＋ 新建作者「${personQuery.trim()}」` }}</span>
                  <small>{{ hasExactAuthorMatch ? '请确认是不同人物，保存作品时才创建' : '保存作品时一并创建作者，不会单独产生空记录' }}</small>
                </button>
              </template>
              <button v-if="personSearchError" type="button" class="book-create__suggestion" @click="findPeople">搜索失败，点击重试</button>
            </div>
          </div>
          <div v-if="selectedAuthorPeople.length || names(authors).length" class="book-create__authors" aria-label="已添加作者">
            <span v-for="person in selectedAuthorPeople" :key="person.id" class="book-create__author-chip">
              {{ person.name }}
              <button type="button" :aria-label="'移除作者' + person.name" @click="removeExistingAuthor(person.id)">×</button>
            </span>
            <span v-for="name in names(authors)" :key="name" class="book-create__author-chip">
              {{ name }} <small>新建</small>
              <button type="button" :aria-label="'移除作者' + name" @click="removeNewAuthor(name)">×</button>
            </span>
          </div>
          <div v-if="nameConflicts.length" class="book-catalog__new-work-card" role="status">
            <p>发现已有同名作者。请选择正确的作者，或确认这是不同的人。</p>
            <div v-for="conflict in nameConflicts" :key="conflict.name">
              <strong>{{ conflict.name }}</strong>
              <div v-for="person in conflict.matches" :key="person.id" class="book-catalog__choice">
                <span>{{ person.name }}</span>
                <PButton type="button" variant="secondary" @click="reusePerson(conflict.name, person.id, false)">使用已有作者</PButton>
              </div>
              <label>
                <input v-model="newAuthorNames" type="checkbox" :value="conflict.name" />
                确认为不同作者，仍新建同名人物
              </label>
            </div>
          </div>
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
          <div v-if="duplicateWorkCandidates.length" class="book-catalog__new-work-card" role="status">
            <p>发现疑似重复作品。建议优先使用已有作品。</p>
            <div v-for="candidate in duplicateWorkCandidates" :key="candidate.work.id" class="book-catalog__choice">
              <span>{{ candidate.work.title }} · {{ candidate.work.authors.map(person => person.name).join(' / ') }}</span>
              <PButton type="button" variant="secondary" @click="useExistingWork(candidate.work.id)">使用此作品</PButton>
            </div>
            <label>
              <input v-model="confirmDuplicateWork" type="checkbox" />
              我已确认是不同作品，仍然新建，不自动合并
            </label>
          </div>
        </div>
      </fieldset>
      <div class="book-catalog__actions">
        <PButton type="submit" :disabled="!canContinue || busy">下一步：版本／译本</PButton>
        <PButton
          v-if="workChoice === 'new'"
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
      <!-- 所属作品摘要卡片 -->
      <div class="book-catalog__summary-card">
        <div class="book-catalog__summary-badge">当前图书作品</div>
        <div class="book-catalog__summary-title">{{ selectedWork?.title || title }}</div>
        <div class="book-catalog__summary-authors">
          {{ selectedWork?.authors.map(person => person.name).join(' / ') || authors }}
          <span v-if="originalTitle" class="book-catalog__summary-original">· {{ originalTitle }}</span>
        </div>
      </div>

      <div class="book-catalog__new-edition-card">
        <h3>1. 先选择电子书文件</h3>
        <label for="edition-source-file">电子书文件（必填）</label>
        <input id="edition-source-file" type="file" accept=".epub,.pdf,.txt,.cbz,.cbr" @change="chooseFile" />
        <p v-if="file">{{ file.name }} · {{ Math.round(file.size / 1024) }} KB</p>
        <p v-if="coverBusy" role="status">正在分析文件前五页及书目元数据…</p>
        <p v-if="coverExplanation">{{ coverExplanation }}</p>
        <div v-if="coverCandidates.length" class="book-catalog__cover-candidates">
          <button v-for="(candidate,index) in coverCandidates" :key="index" type="button"
            :class="{ 'is-selected': selectedCover === candidate.dataUrl }"
            :aria-pressed="selectedCover === candidate.dataUrl"
            @click="selectedCover = candidate.dataUrl">
            <img :src="candidate.dataUrl" :alt="candidate.label" loading="lazy" />
            <small>{{ candidate.label }}{{ selectedCover === candidate.dataUrl ? ' · 已选择' : '' }}</small>
          </button>
        </div>
        <label for="edition-manual-cover">封面不正确？手动上传封面图片</label>
        <input id="edition-manual-cover" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseCoverImage" />
        <div v-if="selectedCover" class="book-catalog__selected-cover">
          <img :src="selectedCover" alt="已选择的出版封面" />
          <span>已选择封面，可继续核对出版资料</span>
        </div>
        <p v-else role="status">请选择以上候选之一，或手动上传出版封面。</p>
      </div>
      <p class="book-catalog__step-intro">2. 核对出版版本与书目资料，自动识别结果均可修改。</p>

      <fieldset class="book-catalog__fields" :disabled="busy">
        <PInput
          v-if="selectedWork?.editions.length"
          id="create-edition-search"
          v-model="editionQuery"
          label="查找此作品的版本"
          placeholder="ISBN、译者、出版社或语言"
        />
        <p v-if="selectedWork?.editions.length && !matchingEditions.length" class="book-catalog__empty-hint">
          没有找到符合条件的版本，可修改关键词或新建版本。
        </p>

        <div class="book-catalog__choices-container">
          <label
            v-for="edition in matchingEditions"
            :key="edition.id"
            class="book-catalog__choice"
          >
            <input
              v-model="editionChoice"
              type="radio"
              name="edition"
              :value="edition.id"
            />
            <div class="book-catalog__choice-body">
              <span class="book-catalog__choice-title">{{ edition.title || selectedWork?.title }}</span>
              <small>{{ editionSummary(edition) }}</small>
            </div>
          </label>

          <label class="book-catalog__choice">
            <input
              v-model="editionChoice"
              type="radio"
              name="edition"
              value="new"
            />
            <div class="book-catalog__choice-body">
              <span class="book-catalog__choice-title">新建版本／译本</span>
              <small>录入其他出版社、译者、精装版或外文原版</small>
            </div>
          </label>
        </div>

        <!-- 新建版本表单卡片 -->
        <div v-if="editionChoice === 'new'" class="book-catalog__new-edition-card">
          <PInput
            id="create-edition-title"
            v-model="editionTitle"
            label="版本书名（选填）"
            :placeholder="selectedWork?.title || title"
          />
          <PInput
            id="create-edition-subtitle"
            v-model="subtitle"
            label="版本副标题（选填）"
            placeholder="例如 汉译世界学术名著丛书"
          />
          <PTextarea
            id="create-edition-translators"
            v-model="translators"
            label="译者（选填，每行一位）"
            :rows="2"
            placeholder="例如 何怀宏"
          />
          <div v-if="translatorConflicts.length" class="book-catalog__new-work-card" role="status">
            <p>已有同名译者，请选择对应人物或确认新建。</p>
            <div v-for="conflict in translatorConflicts" :key="conflict.name">
              <strong>{{ conflict.name }}</strong>
              <div v-for="person in conflict.matches" :key="person.id" class="book-catalog__choice">
                <span>{{ person.name }}</span>
                <PButton type="button" variant="secondary" @click="reusePerson(conflict.name, person.id, true)">使用已有译者</PButton>
              </div>
              <label>
                <input v-model="newTranslatorNames" type="checkbox" :value="conflict.name" />
                确认为不同人物，仍新建同名译者
              </label>
            </div>
          </div>
          <PInput
            id="create-edition-language"
            v-model="language"
            label="版本语言代码（必填）"
            placeholder="例如 zh 或 en"
          />
          <PInput
            id="create-edition-publisher"
            v-model="publisher"
            list="publisher-suggestions"
            label="出版社（选填）"
            placeholder="输入或选择出版社，例如 商务印书馆"
          />
          <datalist id="publisher-suggestions">
            <option value="商务印书馆" />
            <option value="译林出版社" />
            <option value="生活·读书·新知三联书店" />
            <option value="中华书局" />
            <option value="人民文学出版社" />
            <option value="上海译文出版社" />
            <option value="重庆出版社" />
          </datalist>

          <label class="book-catalog__date-label">
            出版日期（选填，完整日期）
            <PMaskedDateInput v-model="publishedDate" />
          </label>
          <PInput
            id="create-edition-statement"
            v-model="statement"
            label="版次（选填）"
            placeholder="例如 第 2 版、修订版、精装插图版"
          />
          <PInput
            id="create-edition-isbn"
            v-model="isbn"
            label="ISBN（选填）"
            placeholder="例如 9780306406157"
          />
          <PInput
            id="create-edition-pages"
            v-model="pages"
            label="页数（选填）"
            type="number"
            min="1"
            step="1"
          />

        </div>

        <div v-if="editionChoice === 'new' && duplicateEditionCandidates.length" class="book-catalog__new-work-card" role="status">
          <p>发现疑似重复版本，请优先检查已有书目。</p>
          <div v-for="candidate in duplicateEditionCandidates" :key="candidate.edition.id" class="book-catalog__choice">
            <span>{{ candidate.edition.title || selectedWork?.title || title }} · {{ candidate.edition.language }} · {{ candidate.edition.publisher || candidate.edition.isbn13 }}</span>
            <PButton
              v-if="candidate.edition.work_id === createdId"
              type="button"
              variant="secondary"
              @click="useExistingEdition(candidate.edition.id)"
            >使用此版本</PButton>
          </div>
          <label>
            <input v-model="confirmDuplicateEdition" type="checkbox" />
            我已确认是独立的出版版本，仍然新建
          </label>
        </div>
        <dl v-else-if="chosenEdition" class="book-catalog__chosen-box">
          <dt>已选择版本（不会修改已有资料）</dt>
          <dd>{{ editionSummary(chosenEdition) }}</dd>
        </dl>
      </fieldset>

      <p v-if="createdId" role="status" class="book-catalog__success-hint">
        作品已保存。请重试保存版本，不会重复创建作品。
      </p>

      <div class="book-catalog__actions">
        <PButton
          v-if="!createdId"
          type="button"
          variant="secondary"
          :disabled="busy"
          @click="step = 1"
        >
          返回作品
        </PButton>
        <PButton type="submit" :disabled="!editionChoice || busy || !file || !selectedCover || coverBusy">
          {{ busy ? '正在保存…' : '确认版本并上传文件' }}
        </PButton>
      </div>
    </form>

    <!-- Step 3: 关联文件与阅读 -->
    <section v-else-if="createdId && editionId" class="book-catalog__step3-card">
      <div class="book-catalog__step3-header">
        <h2 class="book-catalog__step3-title">上传并验证电子书</h2>
        <p class="book-catalog__step3-sub">
          <strong>{{ selectedWork?.title || title }}</strong> → {{ savedEditionTitle }}
        </p>
      </div>

      <div class="book-catalog__step3-actions">
        <p>文件通过安全检查后，该出版版本才会正式创建并公开展示。</p>
      </div>

      <div class="book-catalog__upload-wrap">
        <BookResourceUpload
          :key="editionId"
          :work-id="createdId"
          :edition-id="editionId"
          :title="savedEditionTitle"
          :initial-file="file"
          :initial-language="savedLanguage"
          @ready="onResourceReady"
        />
      </div>
      <p v-if="coverSaving" role="status">正在保存已选择的出版封面…</p>
      <PButton v-if="resourceReady && selectedCover && !coverSaving" type="button" variant="secondary" @click="onResourceReady">完成封面保存并进入版本详情</PButton>
    </section>
    <p v-if="error" class="book-catalog__error" role="alert">{{ error }}</p>
    <PConfirm :show="leaveOpen" title="离开创建" message="未保存的信息和未上传的本地文件不会保留，确定离开吗？" @confirm="resolveLeave(true)" @cancel="resolveLeave(false)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  checkCatalogEditionDuplicates, checkCatalogWorkDuplicates, createCatalogEdition, createCatalogWork,
  getCatalogWork, searchCatalogWorks, type CatalogWork, type WorkDuplicateMatch, type EditionDuplicateMatch,
} from '@/api/bookCatalog'
import type { CreateCatalogEdition } from '@/entities/book/model/types'
import type { BookPublicEdition, BookPublicWork } from '@/api/books'
import { searchWikiPeople } from '@/api/bookWiki'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import { inspectBookCoverCandidates, coverFromFile, type BookCoverCandidate } from '@/utils/bookCoverCandidates'
import { saveEditionCover } from '@/api/bookFileShelf'
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
const selectedWork = ref<CatalogWork | null>(null), file = shallowRef<File | null>(null)
const coverCandidates = ref<BookCoverCandidate[]>([])
const selectedCover = ref(''), coverExplanation = ref(''), coverBusy = ref(false), coverSaving = ref(false), resourceReady = ref(false)
const title = ref(''), authors = ref(''), originalTitle = ref(''), description = ref('')
const personQuery = ref(''), selectedAuthors = ref<string[]>([]), availablePeople = ref<{ id: string; name: string }[]>([])
const selectedAuthorPeople = ref<{ id: string; name: string }[]>([])
const workSearchRoot = ref<HTMLElement | null>(null), personSearchRoot = ref<HTMLElement | null>(null)
const workListOpen = ref(false), personListOpen = ref(false)
const personSearching = ref(false), personSearched = ref(false), personSearchError = ref('')
let workDebounce: ReturnType<typeof setTimeout> | undefined
let personDebounce: ReturnType<typeof setTimeout> | undefined
let personRequestSequence = 0
const editionTitle = ref(''), subtitle = ref(''), translators = ref(''), language = ref(''), publisher = ref(''), statement = ref(''), isbn = ref(''), pages = ref('')
const publishedDate = ref({ year: '', month: '', day: '' })
const busy = ref(false), error = ref(''), createdId = ref(''), editionId = ref(''), finished = ref(false), leaveOpen = ref(false)
const savedEditionTitle = ref(''), savedLanguage = ref('')
const duplicateWorkCandidates = ref<WorkDuplicateMatch[]>([])
const duplicateEditionCandidates = ref<EditionDuplicateMatch[]>([])
const confirmDuplicateWork = ref(false), confirmDuplicateEdition = ref(false)
const nameConflicts = ref<{ name: string; matches: { id: string; name: string }[] }[]>([])
const translatorConflicts = ref<{ name: string; matches: { id: string; name: string }[] }[]>([])
const newAuthorNames = ref<string[]>([]), newTranslatorNames = ref<string[]>([])
const selectedTranslatorIDs = ref<string[]>([])
let leaveResolve: ((leave: boolean) => void) | undefined
let alive = true, searchController: AbortController | undefined
let previousWorkPayload = '', workRequestID = ''
let previousEditionPayload = '', editionRequestID = ''
function stableRequestID(payload: unknown, kind: 'work' | 'edition') {
  const fingerprint = JSON.stringify(payload)
  if (kind === 'work') {
    if (fingerprint !== previousWorkPayload || !workRequestID) {
      previousWorkPayload = fingerprint
      workRequestID = crypto.randomUUID()
    }
    return workRequestID
  }
  if (fingerprint !== previousEditionPayload || !editionRequestID) {
    previousEditionPayload = fingerprint
    editionRequestID = crypto.randomUUID()
  }
  return editionRequestID
}
const names = (value: string) => [...new Set(value.split('\n').map(name => name.trim()).filter(Boolean))]
const canContinue = computed(() => !!workChoice.value && (workChoice.value !== 'new' || (!!title.value.trim() && (names(authors.value).length > 0 || selectedAuthors.value.length > 0))))
function normalizedPersonName(value: string) { return value.trim().toLocaleLowerCase() }
function normalizedWorkTitle(value: string) { return value.trim().replace(/\s+/g, '').toLocaleLowerCase() }
const hasExactWorkMatch = computed(() => matches.value.some(work => normalizedWorkTitle(work.title) === normalizedWorkTitle(query.value)))
const hasExactAuthorMatch = computed(() => availablePeople.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(personQuery.value)))
const canSuggestNewWork = computed(() => searched.value && !searching.value && !searchError.value && !!query.value.trim())
const canSuggestNewAuthor = computed(() => personSearched.value && !personSearching.value && !personSearchError.value && !!personQuery.value.trim())

function onWorkFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !workSearchRoot.value?.contains(next)) workListOpen.value = false
}
function onPersonFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !personSearchRoot.value?.contains(next)) personListOpen.value = false
}
function selectExistingWork(work: BookPublicWork) {
  workChoice.value = work.id
  workListOpen.value = false
}
function selectNewWork() {
  if (!canSuggestNewWork.value) return
  title.value = query.value.trim()
  workChoice.value = 'new'
  workListOpen.value = false
}
function confirmWorkInput() {
  if (searching.value || !searched.value) return
  const exact = matches.value.find(work => normalizedWorkTitle(work.title) === normalizedWorkTitle(query.value))
  if (exact) selectExistingWork(exact)
  else if (canSuggestNewWork.value) selectNewWork()
}
function addExistingAuthor(person: { id: string; name: string }) {
  if (!selectedAuthors.value.includes(person.id)) {
    selectedAuthors.value.push(person.id)
    selectedAuthorPeople.value.push(person)
  }
  authors.value = names(authors.value).filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name)).join('\n')
  newAuthorNames.value = newAuthorNames.value.filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name))
  personQuery.value = ''
  personListOpen.value = false
}
function addNewAuthor() {
  if (!canSuggestNewAuthor.value) return
  const value = personQuery.value.trim()
  if (hasExactAuthorMatch.value && !newAuthorNames.value.some(name => normalizedPersonName(name) === normalizedPersonName(value))) {
    newAuthorNames.value.push(value)
  }
  if (!names(authors.value).some(name => normalizedPersonName(name) === normalizedPersonName(value)) &&
      !selectedAuthorPeople.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(value))) {
    authors.value = [...names(authors.value), value].join('\n')
  }
  personQuery.value = ''
  personListOpen.value = false
}
function confirmPersonInput() {
  if (personSearching.value || !personSearched.value) return
  const exact = availablePeople.value.find(person => normalizedPersonName(person.name) === normalizedPersonName(personQuery.value))
  if (exact) addExistingAuthor(exact)
  else if (canSuggestNewAuthor.value) addNewAuthor()
}
function removeExistingAuthor(id: string) {
  selectedAuthors.value = selectedAuthors.value.filter(value => value !== id)
  selectedAuthorPeople.value = selectedAuthorPeople.value.filter(person => person.id !== id)
}
function removeNewAuthor(name: string) {
  authors.value = names(authors.value).filter(value => normalizedPersonName(value) !== normalizedPersonName(name)).join('\n')
  newAuthorNames.value = newAuthorNames.value.filter(value => normalizedPersonName(value) !== normalizedPersonName(name))
}
watch(query, value => {
  if (workDebounce) clearTimeout(workDebounce)
  searchController?.abort()
  matches.value = []
  searched.value = false
  searching.value = false
  searchError.value = ''
  title.value = value.trim()
  if (workChoice.value && workChoice.value !== 'new') workChoice.value = ''
  workListOpen.value = !!value.trim()
  if (value.trim()) workDebounce = setTimeout(() => void findWorks(), 260)
})
watch(personQuery, value => {
  if (personDebounce) clearTimeout(personDebounce)
  personRequestSequence++
  availablePeople.value = []
  personSearched.value = false
  personSearching.value = false
  personSearchError.value = ''
  personListOpen.value = !!value.trim()
  if (value.trim() && workChoice.value === 'new') personDebounce = setTimeout(() => void findPeople(), 240)
})

async function findNameConflicts(rawNames: string[], selectedIDs: string[], confirmedNewNames: string[]) {
  const conflicts: { name: string; matches: { id: string; name: string }[] }[] = []
  for (const name of rawNames) {
    if (confirmedNewNames.some(item => normalizedPersonName(item) === normalizedPersonName(name))) continue
    const page = await searchWikiPeople(name)
    const exact = page.items.filter(person => normalizedPersonName(person.name) === normalizedPersonName(name))
    if (exact.length && !exact.some(person => selectedIDs.includes(person.id))) conflicts.push({ name, matches: exact })
  }
  return conflicts
}
function reusePerson(name: string, personId: string, translator: boolean) {
  if (translator) {
    if (!selectedTranslatorIDs.value.includes(personId)) selectedTranslatorIDs.value.push(personId)
    translators.value = names(translators.value).filter(item => normalizedPersonName(item) !== normalizedPersonName(name)).join('\n')
    translatorConflicts.value = translatorConflicts.value.filter(item => item.name !== name)
  } else {
    addExistingAuthor({ id: personId, name })
    nameConflicts.value = nameConflicts.value.filter(item => item.name !== name)
  }
}
async function useExistingWork(id: string) { workChoice.value = id; await next() }
async function useExistingEdition(id: string) {
  const workId = createdId.value || selectedWork.value?.id
  if (!workId) return
  try {
    selectedWork.value = await getCatalogWork(workId)
    editionChoice.value = id
    duplicateEditionCandidates.value = []
    confirmDuplicateEdition.value = false
  } catch { error.value = '版本资料加载失败，请重新查找。' }
}
function isValidISBN(value: string) {
  if (!value) return true
  if (/^\d{9}[\dX]$/.test(value)) {
    return [...value].reduce((sum, char, i) => sum + (char === 'X' ? 10 : Number(char)) * (10 - i), 0) % 11 === 0
  }
  if (/^\d{13}$/.test(value)) {
    return [...value].reduce((sum, char, i) => sum + Number(char) * (i % 2 ? 3 : 1), 0) % 10 === 0
  }
  return false
}
watch([title, authors, originalTitle, selectedAuthors], () => { duplicateWorkCandidates.value = []; confirmDuplicateWork.value = false; nameConflicts.value = [] }, { deep: true })
watch([editionTitle, translators, language, publisher, statement, isbn, publishedDate], () => { duplicateEditionCandidates.value = []; confirmDuplicateEdition.value = false; translatorConflicts.value = [] }, { deep: true })
const chosenEdition = computed(() => selectedWork.value?.editions.find(edition => edition.id === editionChoice.value))
const matchText = (value: string) => value.replace(/[\s-]/g, '').toLowerCase()
const matchingEditions = computed(() => (selectedWork.value?.editions || []).filter(edition => matchText(`${edition.title || ''} ${editionSummary(edition)}`).includes(matchText(editionQuery.value))))
const dirty = computed(() => !finished.value && (!!workChoice.value || !!file.value || [title, authors, query].some(value => !!value.value)))
watch(workChoice, () => { selectedWork.value = null; editionChoice.value = ''; editionQuery.value = ''; error.value = '' })
function editionSummary(edition: BookPublicEdition) { return [edition.subtitle, edition.translators?.map(person => person.name).join(' / '), edition.language, edition.publisher, edition.published_date?.slice(0, 10), edition.edition_statement, edition.isbn13 || edition.isbn10].filter(Boolean).join(' · ') || '版本资料待补充' }
async function findWorks() {
  if (workDebounce) clearTimeout(workDebounce)
  const term = query.value.trim()
  if (!term) return
  searchController?.abort()
  searchController = new AbortController()
  const controller = searchController
  searching.value = true; searched.value = false; searchError.value = ''
  try {
    const result = await searchCatalogWorks(term, 24, 0, controller.signal)
    if (alive && !controller.signal.aborted && query.value.trim() === term) {
      matches.value = result.items
      searched.value = true
    }
  } catch {
    if (alive && !controller.signal.aborted && query.value.trim() === term) searchError.value = '作品查找失败'
  } finally {
    if (alive && controller === searchController) searching.value = false
  }
}
async function findPeople() {
  if (personDebounce) clearTimeout(personDebounce)
  const term = personQuery.value.trim()
  if (!term) return
  const sequence = ++personRequestSequence
  personSearching.value = true; personSearched.value = false; personSearchError.value = ''
  try {
    const result = await searchWikiPeople(term)
    if (alive && sequence === personRequestSequence && personQuery.value.trim() === term) {
      availablePeople.value = result.items
      personSearched.value = true
    }
  } catch {
    if (alive && sequence === personRequestSequence) personSearchError.value = '作者查找失败'
  } finally {
    if (alive && sequence === personRequestSequence) personSearching.value = false
  }
}
async function chooseFile(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  if (!/\.(epub|pdf|txt|cbz|cbr)$/i.test(selected.name) || !selected.size) {
    error.value = '请选择非空的 EPUB、PDF、TXT、CBZ 或 CBR 文件。'
    return
  }
  file.value = selected
  coverCandidates.value = []
  selectedCover.value = ''
  coverExplanation.value = ''
  resourceReady.value = false
  error.value = ''
  coverBusy.value = true
  try {
    const inspection = await inspectBookCoverCandidates(selected)
    if (file.value !== selected || !alive) return
    coverCandidates.value = inspection.candidates
    coverExplanation.value = inspection.explanation
    const data = inspection.metadata
    // Existing user edits always win over file metadata.
    if (!editionTitle.value.trim() && data.title) editionTitle.value = data.title
    if (!language.value.trim() && data.language) language.value = data.language
    if (!publisher.value.trim() && data.publisher) publisher.value = data.publisher
    if (!isbn.value.trim() && data.isbn) isbn.value = data.isbn
    if (!pages.value.trim() && data.pageCount) pages.value = String(data.pageCount)
  } catch (reason) {
    if (alive) error.value = reason instanceof Error
      ? '自动分析失败：' + reason.message + '。可手动上传封面并填写资料。'
      : '自动识别失败，可手动填写资料。'
  } finally { if (alive) coverBusy.value = false }
}
async function chooseCoverImage(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  coverBusy.value = true
  try { selectedCover.value = await coverFromFile(selected); error.value = '' }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '封面读取失败。' }
  finally { coverBusy.value = false }
}
async function onResourceReady() {
  resourceReady.value = true
  if (coverSaving.value || !editionId.value || !selectedCover.value) return
  coverSaving.value = true
  error.value = ''
  try {
    await saveEditionCover(editionId.value, selectedCover.value)
    finished.value = true
    file.value = null
    await router.replace({ path: '/books/edition/' + editionId.value })
  } catch (reason) {
    error.value = '文件已通过安全检查，但出版封面保存失败。可点击下方按钮重试。' +
      (reason instanceof Error ? ' ' + reason.message : '')
  } finally { if (alive) coverSaving.value = false }
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
  if (withEdition && (!file.value || !selectedCover.value)) {
    error.value = '创建出版版本必须上传电子书文件并选择实际出版封面。'
    return
  }
  const newEdition = withEdition && editionChoice.value === 'new'
  const normalizedISBN = isbn.value.replace(/[\s-]/g, '').toUpperCase()
  if (newEdition && !isValidISBN(normalizedISBN)) { error.value = 'ISBN 校验位不正确，请核对 ISBN-10 或 ISBN-13。'; return }
  if (newEdition && !language.value.trim()) { error.value = '出版版本必须填写语言代码，例如 zh 或 en。'; return }
  if (newEdition && pages.value && (!Number.isInteger(Number(pages.value)) || Number(pages.value) < 1)) { error.value = '页数请输入正整数。'; return }
  const date = publishedDate.value
  const dateString = [date.year, date.month, date.day].join('-')
  if (newEdition && [date.year, date.month, date.day].some(Boolean) && (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || Number.isNaN(Date.parse(dateString)) || new Date(dateString).toISOString().slice(0, 10) !== dateString)) { error.value = '请填写完整有效的出版日期，或留空。'; return }
  const editionPayload: CreateCatalogEdition = {
    title: editionTitle.value.trim(), subtitle: subtitle.value.trim(), translators: names(translators.value),
    translator_ids: selectedTranslatorIDs.value, new_translator_names: newTranslatorNames.value,
    language: language.value.trim(), publisher: publisher.value.trim(), edition_statement: statement.value.trim(),
    isbn10: normalizedISBN.length === 10 ? normalizedISBN : '', isbn13: normalizedISBN.length === 13 ? normalizedISBN : '',
    published_date: date.year ? dateString : '', page_count: Number(pages.value || 0), cover_url: '',
  }
  if (newEdition && !normalizedISBN && !(
    (editionPayload.publisher && (editionPayload.published_date || editionPayload.edition_statement || editionPayload.translators?.length || editionPayload.translator_ids?.length)) ||
    (editionPayload.published_date && editionPayload.title && (editionPayload.translators?.length || editionPayload.translator_ids?.length))
  )) { error.value = '未填写 ISBN 时，需要出版社和出版时间、版次或译者等可识别信息。'; return }

  busy.value = true
  error.value = ''
  try {
    if (!createdId.value && workChoice.value === 'new') {
      const input = {
        title: title.value.trim(), authors: names(authors.value), author_ids: selectedAuthors.value,
        original_title: originalTitle.value.trim(),
      }
      nameConflicts.value = await findNameConflicts(input.authors, selectedAuthors.value, newAuthorNames.value)
      if (nameConflicts.value.length) {
        error.value = '已有同名作者，请选择已有作者或确认新建不同人物。'
        return
      }
      duplicateWorkCandidates.value = (await checkCatalogWorkDuplicates(input)).matches
      if (duplicateWorkCandidates.value.length && !confirmDuplicateWork.value) {
        error.value = '发现疑似重复作品，请检查并确认后继续。'
        return
      }
    }
    if (!createdId.value) {
      const workPayload = {
        title: title.value.trim(), authors: names(authors.value), author_ids: selectedAuthors.value,
        new_author_names: newAuthorNames.value, original_title: originalTitle.value.trim(), description: description.value.trim(),
      }
      createdId.value = selectedWork.value?.id || (await createCatalogWork(workPayload, stableRequestID(workPayload, 'work'))).id
    }
    if (!createdId.value) throw new Error('缺少作品 ID')
    if (!withEdition) {
      finished.value = true
      await router.replace({ path: `/books/work/${createdId.value}`, query: route.query })
      return
    }
    if (newEdition) {
      translatorConflicts.value = await findNameConflicts(names(translators.value), selectedTranslatorIDs.value, newTranslatorNames.value)
      if (translatorConflicts.value.length) {
        error.value = '已有同名译者，请选择已有人物或确认新建不同人物。'
        return
      }
      duplicateEditionCandidates.value = (await checkCatalogEditionDuplicates(createdId.value, editionPayload)).matches
      if (duplicateEditionCandidates.value.length && !confirmDuplicateEdition.value) {
        error.value = '发现疑似重复版本，请检查并确认后继续。'
        return
      }
    }
    const edition = newEdition
      ? await createCatalogEdition(createdId.value, editionPayload, stableRequestID({ work_id: createdId.value, ...editionPayload }, 'edition'))
      : chosenEdition.value
    if (!edition?.id) throw new Error('缺少版本 ID')
    editionId.value = edition.id
    savedEditionTitle.value = edition.title || selectedWork.value?.title || title.value
    savedLanguage.value = edition.language || ''
    step.value = 3
    // Wait for the upload scan before treating an Edition as published.
  } catch {
    error.value = createdId.value
      ? '作品已保存，但版本处理未完成。可重试或检查已有版本，避免重复创建。'
      : '创建结果尚未确认，请先搜索是否已创建，避免重复。'
  } finally {
    if (alive) busy.value = false
  }
}
function resolveLeave(leave: boolean) { leaveOpen.value = false; leaveResolve?.(leave); leaveResolve = undefined }
onBeforeRouteLeave(() => { if (finished.value) return true; if (busy.value) return false; if (!dirty.value) return true; leaveOpen.value = true; return new Promise<boolean>(resolve => { leaveResolve = resolve }) })
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => { window.addEventListener('beforeunload', beforeUnload); if (typeof route.query.work === 'string') { workChoice.value = route.query.work; await next() } })
onBeforeUnmount(() => { alive = false; if (workDebounce) clearTimeout(workDebounce); if (personDebounce) clearTimeout(personDebounce); personRequestSequence++; searchController?.abort(); window.removeEventListener('beforeunload', beforeUnload); leaveResolve?.(false) })
</script>

<style scoped>
.book-create__combobox { position: relative; min-width: 0; }
.book-create__suggestions {
  position: absolute;
  z-index: 30;
  top: calc(100% + .25rem);
  left: 0;
  right: 0;
  max-height: 18rem;
  overflow-y: auto;
  padding: .25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  box-shadow: 0 10px 24px rgb(0 0 0 / 12%);
}
.book-create__suggestion {
  display: grid;
  width: 100%;
  min-height: 48px;
  gap: .2rem;
  padding: .625rem .75rem;
  text-align: left;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text);
  font: inherit;
  cursor: pointer;
}
.book-create__suggestion:hover, .book-create__suggestion:focus-visible { background: var(--a-color-surface-muted); }
.book-create__suggestion:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: -2px; }
.book-create__suggestion:disabled { opacity: .55; cursor: default; }
.book-create__suggestion-title { font-size: .9375rem; font-weight: 600; overflow-wrap: anywhere; }
.book-create__suggestion small { color: var(--a-color-muted); font-size: .8rem; }
.book-create__suggestion--create { color: var(--a-color-primary); border-top: 1px solid var(--a-color-border-soft); border-radius: 0; }
.book-create__suggestions-status { margin: 0; padding: .75rem; color: var(--a-color-muted); font-size: .875rem; }
.book-create__selected-hint { margin: 0; padding: .7rem .85rem; border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); }
.book-create__text-action { margin-left: .75rem; padding: .1rem 0; border: 0; background: none; color: var(--a-color-primary); font: inherit; cursor: pointer; }
.book-create__authors { display: flex; flex-wrap: wrap; gap: .5rem; }
.book-create__author-chip { display: inline-flex; align-items: center; gap: .4rem; max-width: 100%; padding: .4rem .65rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); font-size: .875rem; overflow-wrap: anywhere; }
.book-create__author-chip small { color: var(--a-color-muted); font-size: .75rem; }
.book-create__author-chip button { border: 0; background: none; color: var(--a-color-muted); cursor: pointer; font-size: 1.05rem; line-height: 1; }
.book-create__author-chip button:hover, .book-create__author-chip button:focus-visible { color: var(--a-color-danger); }
.book-catalog__cover-candidates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: .7rem;
  margin: 1rem 0;
}
.book-catalog__cover-candidates button {
  display: grid;
  gap: .4rem;
  padding: .4rem;
  background: transparent;
  border: 1px solid var(--a-color-border-soft);
  border-radius: .5rem;
  cursor: pointer;
}
.book-catalog__cover-candidates button.is-selected {
  border: 2px solid var(--a-color-primary, var(--a-color-text-primary));
}
.book-catalog__cover-candidates img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: contain;
  background: var(--a-color-bg);
}
.book-catalog__cover-candidates small {
  font-size: .75rem;
  text-align: center;
  color: var(--a-color-text-secondary);
}
.book-catalog__selected-cover {
  display: flex;
  align-items: center;
  gap: .9rem;
  margin-top: .9rem;
}
.book-catalog__selected-cover img {
  width: 90px;
  max-height: 130px;
  object-fit: contain;
}
</style>
