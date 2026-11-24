<template>
  <div class="private-books">
    <slot name="trigger" :open="open">
      <PButton :variant="buttonVariant" :size="size" @click="open">
        {{ buttonText || `${label}资料与修订历史` }}
      </PButton>
    </slot>
    <PSheet :show="opened" :title="`${label}资料`" mode="full" teleport-mobile @close="requestClose">
      <section class="private-books private-books__editor">
        <p class="wiki-notice-tip">登录用户修改后直接公开，无需审核。保存时检查基础修订，冲突不会自动覆盖。</p>
        <p v-if="loading" role="status" class="wiki-status">正在加载资料…</p>
        <p v-if="error" role="alert" class="wiki-alert wiki-alert--error">{{ error }}</p>
        <p v-if="notice" role="status" class="wiki-alert wiki-alert--success">{{ notice }}</p>
        <PButton v-if="error && !head" variant="secondary" @click="load">重新加载</PButton>
        <form v-if="head && authenticated" class="wiki-form" @submit.prevent="save">
          <div class="wiki-form-grid">
            <label v-for="field in fieldDefinitions" :key="field.key" class="wiki-form-field" :class="{ 'is-wide': field.key === 'description' || field.key === 'title' }">
              <span class="wiki-form-label">
                {{ field.label }}
                <span v-if="field.required" class="wiki-required" aria-hidden="true">*</span>
              </span>
              <textarea v-if="field.key === 'description'" v-model="values[field.key]" rows="4" :readonly="busy" class="wiki-input wiki-textarea" />
              <PMaskedDateInput v-else-if="field.type === 'date'" :inert="busy || undefined" :model-value="dateParts(values[field.key] || '')" @update:model-value="values[field.key] = [$event.year, $event.month, $event.day].join('-')" />
              <input v-else v-model="values[field.key]" :type="field.type || 'text'" :readonly="busy" :min="field.type === 'number' ? 0 : undefined" class="wiki-input" />
            </label>
          </div>
          <div v-if="kind === 'edition'" class="wiki-cover-section">
            <span class="wiki-form-label">版本封面</span>
            <div class="wiki-cover-card">
              <div class="wiki-cover-preview-box">
                <BookCover
                  :src="coverPreview || values.cover_url"
                  :title="values.title || '版本封面'"
                  variant="edition"
                />
              </div>
              <div class="wiki-cover-info">
                <div class="wiki-cover-actions">
                  <input
                    ref="coverFileInputRef"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style="display: none"
                    @change="onCoverFileSelected"
                  />
                  <PButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    :disabled="busy || coverUploading"
                    :loading="coverUploading"
                    @click="triggerCoverPicker"
                  >
                    {{ (values.cover_url || coverPreview) ? '更换封面图片' : '上传封面图片' }}
                  </PButton>
                  <PButton
                    v-if="values.cover_url || coverPreview"
                    type="button"
                    variant="ghost"
                    size="sm"
                    :disabled="busy || coverUploading"
                    @click="removeCover"
                  >
                    移除封面
                  </PButton>
                </div>
                <p class="wiki-cover-hint">支持 JPG、PNG、WebP 格式，选择图片后直接上传</p>
                <p v-if="coverError" role="alert" class="wiki-cover-error">{{ coverError }}</p>
              </div>
            </div>
          </div>
          <template v-if="kind === 'work' || kind === 'edition'">
            <fieldset class="wiki-fieldset" :disabled="busy">
              <legend class="wiki-legend">
                {{ kind === 'work' ? '作者（至少一位）' : '译者（可选）' }}
                <span v-if="kind === 'work'" class="wiki-required" aria-hidden="true">*</span>
              </legend>
              <div class="wiki-people-chips">
                <label v-for="person in selectedPeople" :key="person.id" class="wiki-person-chip">
                  <input type="checkbox" :checked="selectedIds.includes(person.id)" @change="toggleAuthor(person.id)" />
                  <span>{{ person.name }}</span>
                </label>
              </div>
              <div class="wiki-people-search">
                <input v-model="personQuery" placeholder="输入姓名搜索或快速创建" class="wiki-input wiki-search-input" />
                <PButton type="button" variant="secondary" size="sm" @click="searchPeople">搜索人物</PButton>
                <PButton type="button" variant="ghost" size="sm" :disabled="!personQuery.trim()" @click="createPerson">创建并选用</PButton>
              </div>
              <div v-if="personResults.length" class="wiki-people-results">
                <label v-for="person in personResults.filter(person => !selectedPeople.some(value => value.id === person.id))" :key="person.id" class="wiki-person-result">
                  <input type="checkbox" @change="addAuthor(person)" />
                  <span>{{ person.name }}</span>
                </label>
              </div>
            </fieldset>
          </template>
          <label class="wiki-form-field is-wide">
            <span class="wiki-form-label">修改说明</span>
            <input v-model="summary" placeholder="简要说明修改内容（如：修正出版社名称、补充 ISBN）" :readonly="busy" class="wiki-input" />
          </label>
          <div class="wiki-form-actions">
            <PButton type="submit" :disabled="busy || conflicted">{{ busy ? '正在保存…' : '保存并公开' }}</PButton>
          </div>
          <p v-if="conflicted" class="wiki-conflict-tip">其他用户已修改，输入仍保留。请复制需要的内容，再关闭并重新打开，以最新修订为基础编辑。</p>
        </form>
        <details class="wiki-history-details">
          <summary class="wiki-history-summary">
            <div class="wiki-history-summary__left">
              <span class="wiki-history-title">修订历史</span>
              <span class="wiki-history-count">{{ historyTotal || history.length }} 次修订</span>
            </div>
            <ChevronDown :size="16" class="wiki-history-chevron" aria-hidden="true" />
          </summary>
          <div class="wiki-history-content">
            <div v-if="!history.length" class="wiki-history-empty">暂无修订记录</div>
            <div v-else class="wiki-history-list">
              <article v-for="revision in history" :key="revision.id" class="wiki-history-card">
                <div class="wiki-history-card__header">
                  <strong>第 {{ revision.version }} 版{{ revision.is_current ? '（当前）' : '' }}</strong>
                  <span class="wiki-history-card__summary">{{ revision.summary || revision.edit_type }}</span>
                </div>
                <details class="wiki-history-diff">
                  <summary>查看字段差异</summary>
                  <dl class="wiki-history-dl">
                    <template v-for="change in revision.changes" :key="change.field">
                      <dt>{{ change.field }}</dt>
                      <dd>{{ formatValue(change.before) }} → {{ formatValue(change.after) }}</dd>
                    </template>
                  </dl>
                </details>
                <PButton v-if="authenticated && !revision.is_current && !['merge', 'merge_revert'].includes(revision.edit_type)" variant="ghost" size="sm" :disabled="busy || dirty" @click="reverting = revision">恢复此版资料</PButton>
              </article>
            </div>
            <PButton v-if="history.length < historyTotal" variant="secondary" size="sm" :disabled="busy" @click="moreHistory">更多修订</PButton>
          </div>
        </details>
        <details v-if="authenticated && head" class="wiki-merge-panel">
          <summary>合并重复{{ label }}</summary>
          <div class="wiki-merge-content">
            <p>当前条目将合并至目标条目，访问原条目时会自动跳转至新条目。</p>
            <div class="wiki-merge-search-row">
              <input v-model="targetQuery" placeholder="搜索目标条目" class="wiki-input" />
              <PButton variant="secondary" size="sm" :disabled="busy || dirty" @click="searchTargets">搜索目标</PButton>
            </div>
            <label class="wiki-form-field">
              <span class="wiki-form-label">目标条目</span>
              <select v-model="targetId" class="wiki-select">
                <option value="">请选择目标</option>
                <option v-for="target in targets" :key="target.id" :value="target.id">{{ target.name }}</option>
              </select>
            </label>
            <PButton variant="secondary" size="sm" :disabled="busy || !targetId || dirty" @click="preview">预览合并</PButton>
            <div v-if="mergePreview" class="wiki-merge-preview">
              <p>{{ mergePreview.conflict_policy }}</p>
              <dl>
                <template v-for="(count, table) in mergePreview.record_counts" :key="table">
                  <dt>{{ table }}</dt>
                  <dd>{{ count }} 条</dd>
                </template>
              </dl>
              <PButton :disabled="busy" @click="confirmMerge = true">确认合并到所选目标</PButton>
            </div>
          </div>
        </details>
        <div v-for="merge in merges" :key="merge.id" class="wiki-merge-item">
          <p>合并 {{ merge.source_id }} → {{ merge.target_id }}（{{ merge.status === 'merged' ? '已合并' : '已撤销' }}）</p>
          <PButton v-if="authenticated && merge.status === 'merged'" variant="secondary" size="sm" :disabled="busy || dirty" @click="undoing = merge">撤销此合并</PButton>
        </div>
      </section>
      <PConfirm :show="confirmClose" title="放弃修改" message="未保存的输入不会公开。" @confirm="finishClose(true)" @cancel="finishClose(false)" />
      <PConfirm :show="!!reverting" title="恢复历史版本" message="这会创建一条新修订，不会删除已有历史。" @confirm="revert" @cancel="reverting = null" />
      <PConfirm :show="confirmMerge" title="合并条目" message="将保留目标资料并迁移关联关系。请核对预览。" @confirm="merge" @cancel="confirmMerge = false" />
      <PConfirm :show="!!undoing" title="撤销合并" message="后续资料或关联数据有变化时，将拒绝撤销以保护新数据。" @confirm="undoMerge" @cancel="undoing = null" />
    </PSheet>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, searchCatalogWorks } from '@/api/bookCatalog'
import { wikiHistory, wikiMetadata, patchWiki, revertWiki, previewWikiMerge, mergeWiki, revertWikiMerge, wikiMerges, searchWikiPeople, createWikiPerson, type WikiKind, type WikiRevision, type WikiMerge, type MergePreview } from '@/api/bookWiki'
import { saveEditionCover } from '@/api/bookFileShelf'
import { coverFromFile } from '@/utils/bookCoverCandidates'
import BookCover from '@/components/books/BookCover.vue'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
const props = withDefaults(defineProps<{
  kind: WikiKind
  entityId: string
  authenticated: boolean
  workId?: string
  buttonText?: string
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}>(), {
  buttonVariant: 'secondary',
  size: 'md',
})
const emit = defineEmits<{ changed: [] }>()
const label = computed(() => ({ work: '作品', person: '作者', edition: '出版版本' })[props.kind])
const opened = ref(false), loading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), conflicted = ref(false), head = ref(''), canonicalId = ref(props.entityId)
const values = ref<Record<string, string>>({}), summary = ref(''), original = ref(''), selectedIds = ref<string[]>([]), selectedPeople = ref<{ id: string; name: string }[]>([]), personQuery = ref(''), personResults = ref<{ id: string; name: string }[]>([])
const history = ref<WikiRevision[]>([]), historyTotal = ref(0), merges = ref<WikiMerge[]>([]), reverting = ref<WikiRevision | null>(null), undoing = ref<WikiMerge | null>(null), confirmMerge = ref(false), confirmClose = ref(false)
const targetQuery = ref(''), targetId = ref(''), targets = ref<{ id: string; name: string }[]>([]), mergePreview = ref<MergePreview | null>(null)

interface WikiFieldDef {
  key: string
  label: string
  type?: string
  required?: boolean
}

const fieldDefinitions = computed<WikiFieldDef[]>(() => {
  if (props.kind === 'person') {
    return [
      { key: 'name', label: '作者姓名', required: true },
      { key: 'description', label: '作者简介' },
    ]
  }
  if (props.kind === 'work') {
    return [
      { key: 'title', label: '作品书名', required: true },
      { key: 'original_title', label: '原作名' },
      { key: 'description', label: '作品简介' },
    ]
  }
  return [
    { key: 'title', label: '版本书名', required: true },
    { key: 'subtitle', label: '版本副标题' },
    { key: 'edition_statement', label: '版次' },
    { key: 'publisher', label: '出版社', required: true },
    { key: 'producer', label: '出品方' },
    { key: 'isbn10', label: 'ISBN-10' },
    { key: 'isbn13', label: 'ISBN-13' },
    { key: 'language', label: '语言代码', required: true },
    { key: 'published_date', label: '出版年月', type: 'month' },
    { key: 'page_count', label: '页数', type: 'number' },
    { key: 'binding', label: '装帧' },
  ]
})

const coverFileInputRef = ref<HTMLInputElement | null>(null)
const coverUploading = ref(false)
const coverError = ref('')
const coverPreview = ref('')

function triggerCoverPicker() {
  coverError.value = ''
  coverFileInputRef.value?.click()
}

async function onCoverFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  coverUploading.value = true
  coverError.value = ''
  try {
    const dataUrl = await coverFromFile(file)
    coverPreview.value = dataUrl
    if (props.kind === 'edition' && canonicalId.value) {
      const res = await saveEditionCover(canonicalId.value, dataUrl)
      values.value.cover_url = res.cover_url
      coverPreview.value = res.cover_url
      notice.value = '封面上传成功'
      emit('changed')
      const page = await wikiHistory(props.kind, canonicalId.value)
      history.value = page.items
      historyTotal.value = page.total
      const meta = await wikiMetadata(props.kind, canonicalId.value)
      head.value = meta.revision_id
      original.value = serialized()
    } else {
      values.value.cover_url = dataUrl
    }
  } catch (err: unknown) {
    coverError.value = err instanceof Error ? err.message : '封面上传失败，请重试'
  } finally {
    coverUploading.value = false
    if (input) input.value = ''
  }
}

function removeCover() {
  values.value.cover_url = ''
  coverPreview.value = ''
}

const serialized = () => JSON.stringify([values.value, selectedIds.value, summary.value])
const dirty = computed(() => opened.value && !!head.value && serialized() !== original.value)
let closeResolve: ((value: boolean) => void) | undefined
function formatValue(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value) }
function dateParts(value: string) { const [year = '', month = '', day = ''] = value.split('-'); return { year, month, day } }
async function open() { opened.value = true; await load() }
async function load() {
  loading.value = true
  head.value = ''
  error.value = ''
  conflicted.value = false
  mergePreview.value = null
  coverError.value = ''
  try {
    let fields: Record<string, unknown>
    if (props.kind === 'work') {
      const work = await getCatalogWork(props.entityId)
      fields = { ...work }
      head.value = work.revision_id
      canonicalId.value = work.id
      selectedPeople.value = work.authors
      selectedIds.value = work.authors.map(person => person.id)
    } else {
      const metadata = await wikiMetadata(props.kind, props.entityId)
      fields = metadata.fields
      head.value = metadata.revision_id
      canonicalId.value = metadata.entity_id
      if (props.kind === 'edition') {
        const work = await getCatalogWork(String(fields.work_id))
        selectedPeople.value = work.editions.find(edition => edition.id === metadata.entity_id)?.translators || []
        selectedIds.value = selectedPeople.value.map(person => person.id)
      }
    }
    values.value = Object.fromEntries(fieldDefinitions.value.map(field => [field.key, field.type === 'month' ? String(fields[field.key] || '').slice(0, 7) : field.type === 'date' ? String(fields[field.key] || '').slice(0, 10) : String(fields[field.key] ?? '')]))
    if (props.kind === 'edition') {
      values.value.cover_url = String(fields.cover_url || '')
      coverPreview.value = String(fields.cover_url || '')
    }
    summary.value = ''
    original.value = serialized()
    const page = await wikiHistory(props.kind, canonicalId.value)
    history.value = page.items
    historyTotal.value = page.total
    merges.value = (await wikiMerges(props.kind, props.entityId)).items
  } catch {
    error.value = '资料或修订历史加载失败，请重试。'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (busy.value || conflicted.value) return
  busy.value = true
  error.value = ''
  try {
    const fields: Record<string, unknown> = { ...values.value }
    if (props.kind === 'work') fields.author_ids = selectedIds.value
    if (props.kind === 'edition') {
      fields.translator_ids = selectedIds.value
      fields.page_count = Number(fields.page_count || 0)
      fields.published_date = String(fields.published_date || '').replaceAll('-', '') ? `${String(fields.published_date).slice(0, 7)}-01T00:00:00Z` : null
      fields.cover_url = values.value.cover_url || ''
    }
    await patchWiki(props.kind, canonicalId.value, head.value, fields, summary.value)
    emit('changed')
    await load()
    notice.value = '资料已公开，修订历史已保留。'
  } catch (err) {
    conflicted.value = err instanceof ApiErrorResponseError && err.status === 409
    error.value = '保存失败，输入仍保留。请检查内容或基础修订后重试。'
  } finally {
    busy.value = false
  }
}
async function moreHistory() { try { const page = await wikiHistory(props.kind, canonicalId.value, history.value.length); history.value.push(...page.items); historyTotal.value = page.total } catch { error.value = '历史加载失败。' } }
function toggleAuthor(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(value => value !== id) : [...selectedIds.value, id] }
function addAuthor(person: { id: string; name: string }) { selectedPeople.value.push(person); selectedIds.value.push(person.id) }
async function searchPeople() { try { personResults.value = (await searchWikiPeople(personQuery.value)).items } catch { error.value = '作者搜索失败。' } }
async function createPerson() { if (busy.value) return; busy.value = true; try { addAuthor(await createWikiPerson(personQuery.value)); personQuery.value = '' } catch { error.value = '创建作者失败。' } finally { busy.value = false } }
async function revert() { const revision = reverting.value; reverting.value = null; if (!revision) return; busy.value = true; try { await revertWiki(revision.id, head.value); emit('changed'); await load() } catch { error.value = '恢复失败，资料可能已被其他人更新，请重新打开后重试。' } finally { busy.value = false } }
async function searchTargets() { mergePreview.value = null; targetId.value = ''; try { if (props.kind === 'person') targets.value = (await searchWikiPeople(targetQuery.value)).items; else if (props.kind === 'work') targets.value = (await searchCatalogWorks(targetQuery.value)).items.map(work => ({ id: work.id, name: work.title })); else { const work = await getCatalogWork(props.workId || ''); targets.value = work.editions.map(edition => ({ id: edition.id, name: `${edition.title || work.title} ${edition.publisher || ''} ${edition.isbn13 || ''}` })).filter(item => item.name.includes(targetQuery.value)) }; targets.value = targets.value.filter(item => item.id !== canonicalId.value) } catch { error.value = '合并目标加载失败。' } }
async function preview() { busy.value = true; try { mergePreview.value = await previewWikiMerge(props.kind, canonicalId.value, targetId.value) } catch { error.value = '无法预览合并，请检查条目后重试。' } finally { busy.value = false } }
async function merge() { confirmMerge.value = false; if (!mergePreview.value) return; busy.value = true; try { const journal = await mergeWiki(props.kind, mergePreview.value); merges.value.unshift(journal); emit('changed'); await load(); notice.value = '合并完成，旧 ID 已永久重定向。' } catch { error.value = '合并失败或预览已过期，请重新预览。'; mergePreview.value = null } finally { busy.value = false } }
async function undoMerge() { const journal = undoing.value; undoing.value = null; if (!journal) return; busy.value = true; try { await revertWikiMerge(journal.id); emit('changed'); await load(); notice.value = '合并已撤销。' } catch { error.value = '无法撤销：合并后资料或关联数据可能已变化，未覆盖任何新数据。' } finally { busy.value = false } }
function requestClose(): Promise<boolean> { if (busy.value) return Promise.resolve(false); if (!dirty.value) { opened.value = false; return Promise.resolve(true) } confirmClose.value = true; return new Promise(resolve => { closeResolve = resolve }) }
function finishClose(value: boolean) { confirmClose.value = false; if (value) opened.value = false; closeResolve?.(value); closeResolve = undefined }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeRouteLeave(() => opened.value ? requestClose() : true)
onBeforeUnmount(() => { closeResolve?.(false); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<style scoped>
.private-books__editor {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 820px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  box-sizing: border-box;
}

.wiki-notice-tip {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
  margin: 0;
}

.wiki-status {
  font-size: 0.875rem;
  color: var(--a-color-muted);
}

.wiki-alert {
  padding: 0.65rem 0.85rem;
  border-radius: var(--a-radius-control, 6px);
  font-size: 0.8125rem;
  margin: 0;
}

.wiki-alert--error {
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.2);
}

.wiki-alert--success {
  background: rgba(52, 199, 89, 0.08);
  color: #248a3d;
  border: 1px solid rgba(52, 199, 89, 0.2);
}

.wiki-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.wiki-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 640px) {
  .wiki-form-grid {
    grid-template-columns: 1fr;
  }
}

.wiki-form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.wiki-form-field.is-wide {
  grid-column: 1 / -1;
}

.wiki-form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.wiki-required {
  color: #ff3b30;
  font-weight: 600;
}

.wiki-cover-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.wiki-cover-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  border-radius: var(--a-radius-card, 8px);
}

.wiki-cover-preview-box {
  width: 76px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.wiki-cover-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.wiki-cover-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.wiki-cover-hint {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.wiki-cover-error {
  font-size: 0.75rem;
  color: #ff3b30;
  margin: 0;
}

.wiki-input,
.wiki-select,
.wiki-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--a-color-text, #1c1c1e);
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.12));
  border-radius: var(--a-radius-control, 6px);
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wiki-input:focus,
.wiki-select:focus,
.wiki-textarea:focus {
  outline: none;
  border-color: var(--a-color-primary, #007aff);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.15);
}

.wiki-textarea {
  resize: vertical;
  min-height: 5rem;
}

.wiki-fieldset {
  grid-column: 1 / -1;
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  border-radius: var(--a-radius-card, 8px);
  padding: 0.875rem 1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wiki-legend {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-text-secondary, #64748b);
  padding: 0 0.35rem;
}

.wiki-people-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wiki-person-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 122, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
}

.wiki-people-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.wiki-people-results {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wiki-person-result {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  padding: 0.25rem 0.5rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border-radius: 4px;
  cursor: pointer;
}

.wiki-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.wiki-conflict-tip {
  font-size: 0.8125rem;
  color: #ff9500;
  margin: 0;
}

.wiki-history-details {
  margin-top: 1.5rem;
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  border-radius: var(--a-radius-card, 8px);
  background: var(--a-color-bg, #ffffff);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.wiki-history-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  cursor: pointer;
  user-select: none;
  background: var(--a-color-surface-muted, #f8fafc);
  list-style: none;
}

.wiki-history-summary::-webkit-details-marker {
  display: none;
}

.wiki-history-summary__left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.wiki-history-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
}

.wiki-history-count {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  background: rgba(0, 0, 0, 0.05);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.wiki-history-chevron {
  color: var(--a-color-text-secondary, #64748b);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.wiki-history-details[open] .wiki-history-chevron {
  transform: rotate(180deg);
}

.wiki-history-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.06));
}

.wiki-history-empty {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  text-align: center;
  padding: 1rem 0;
}

.wiki-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wiki-history-card {
  padding: 0.875rem 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.06));
  border-radius: var(--a-radius-card, 8px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wiki-history-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.wiki-history-card__summary {
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.8125rem;
}

.wiki-history-diff summary {
  cursor: pointer;
  font-size: 0.78125rem;
  color: var(--a-color-primary, #007aff);
}

.wiki-history-dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  font-size: 0.78125rem;
  margin: 0.5rem 0 0;
}

.wiki-history-dl dt {
  font-weight: 600;
  color: var(--a-color-text-secondary);
}

.wiki-history-dl dd {
  margin: 0;
  color: var(--a-color-text);
  word-break: break-all;
}

.wiki-merge-panel {
  margin-top: 1.5rem;
  border: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  border-radius: var(--a-radius-card, 8px);
  padding: 0.75rem 1rem;
}

.wiki-merge-panel summary {
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}

.wiki-merge-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.wiki-merge-search-row {
  display: flex;
  gap: 0.5rem;
}

.wiki-merge-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
}
</style>
