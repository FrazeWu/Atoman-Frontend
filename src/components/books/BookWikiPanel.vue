<template>
  <div class="private-books">
    <PButton variant="secondary" @click="open">{{ label }}资料与修订历史</PButton>
    <PSheet :show="opened" :title="`${label}开放 Wiki`" mode="full" teleport-mobile @close="requestClose">
      <section class="private-books private-books__editor">
        <p>登录用户修改后直接公开，无需审核。保存时检查基础修订，冲突不会自动覆盖。</p>
        <p v-if="loading" role="status">正在加载资料…</p>
        <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
        <PButton v-if="error && !head" variant="secondary" @click="load">重新加载</PButton>
        <form v-if="head && authenticated" class="private-books" @submit.prevent="save">
          <label v-for="field in fieldDefinitions" :key="field.key">{{ field.label }}
            <textarea v-if="field.key === 'description'" v-model="values[field.key]" rows="6" :readonly="busy" />
            <PMaskedDateInput v-else-if="field.type === 'date'" :inert="busy || undefined" :model-value="dateParts(values[field.key] || '')" @update:model-value="values[field.key] = [$event.year, $event.month, $event.day].join('-')" />
            <input v-else v-model="values[field.key]" :type="field.type || 'text'" :readonly="busy" :min="field.type === 'number' ? 0 : undefined" />
          </label>
          <template v-if="kind === 'work'">
            <fieldset :disabled="busy"><legend>作者（至少一位）</legend>
              <label v-for="person in selectedPeople" :key="person.id"><input type="checkbox" :checked="selectedIds.includes(person.id)" @change="toggleAuthor(person.id)" />{{ person.name }}</label>
              <label>搜索或快速创建作者<input v-model="personQuery" /></label><PButton type="button" variant="secondary" @click="searchPeople">搜索作者</PButton><PButton type="button" variant="ghost" :disabled="!personQuery.trim()" @click="createPerson">创建并选用该作者</PButton>
              <label v-for="person in personResults.filter(person => !selectedPeople.some(value => value.id === person.id))" :key="person.id"><input type="checkbox" @change="addAuthor(person)" />{{ person.name }}</label>
            </fieldset>
          </template>
          <label>修改说明<input v-model="summary" :readonly="busy" /></label>
          <PButton type="submit" :disabled="busy || conflicted">{{ busy ? '正在保存…' : '保存并公开' }}</PButton>
          <p v-if="conflicted">其他用户已修改，输入仍保留。请复制需要的内容，再关闭并重新打开，以最新修订为基础编辑。</p>
        </form>
        <h2>修订历史</h2>
        <article v-for="revision in history" :key="revision.id" class="book-catalog__row">
          <strong>第 {{ revision.version }} 版{{ revision.is_current ? '（当前）' : '' }}</strong><span>{{ revision.summary || revision.edit_type }}</span>
          <details><summary>查看真实字段差异</summary><dl><template v-for="change in revision.changes" :key="change.field"><dt>{{ change.field }}</dt><dd class="private-books__body">{{ formatValue(change.before) }} → {{ formatValue(change.after) }}</dd></template></dl></details>
          <PButton v-if="authenticated && !revision.is_current && !['merge', 'merge_revert'].includes(revision.edit_type)" variant="ghost" :disabled="busy || dirty" @click="reverting = revision">恢复此版资料</PButton>
        </article>
        <PButton v-if="history.length < historyTotal" variant="secondary" :disabled="busy" @click="moreHistory">更多修订</PButton>
        <details v-if="authenticated && head"><summary>合并重复{{ label }}</summary>
          <p>当前条目作为来源，保留目标条目的资料。旧 ID 将指向目标，错误合并可在后续数据未变化时撤销。</p>
          <label>搜索目标<input v-model="targetQuery" /></label><PButton variant="secondary" :disabled="busy || dirty" @click="searchTargets">搜索目标</PButton>
          <label>目标条目<select v-model="targetId"><option value="">请选择目标</option><option v-for="target in targets" :key="target.id" :value="target.id">{{ target.name }}</option></select></label>
          <PButton variant="secondary" :disabled="busy || !targetId || dirty" @click="preview">预览合并</PButton>
          <div v-if="mergePreview"><p>{{ mergePreview.conflict_policy }}</p><dl><template v-for="(count, table) in mergePreview.record_counts" :key="table"><dt>{{ table }}</dt><dd>{{ count }} 条</dd></template></dl><PButton :disabled="busy" @click="confirmMerge = true">确认合并到所选目标</PButton></div>
        </details>
        <div v-for="merge in merges" :key="merge.id"><p>合并 {{ merge.source_id }} → {{ merge.target_id }}（{{ merge.status === 'merged' ? '已合并' : '已撤销' }}）</p><PButton v-if="authenticated && merge.status === 'merged'" variant="secondary" :disabled="busy || dirty" @click="undoing = merge">撤销此合并</PButton></div>
      </section>
      <PConfirm :show="confirmClose" title="放弃未保存的资料？" message="未保存的输入不会公开。" @confirm="finishClose(true)" @cancel="finishClose(false)" />
      <PConfirm :show="!!reverting" title="恢复历史资料？" message="这会创建一条新修订，不会删除已有历史。" @confirm="revert" @cancel="reverting = null" />
      <PConfirm :show="confirmMerge" title="确认合并重复条目？" message="将保留目标资料并迁移关联关系。请核对预览。" @confirm="merge" @cancel="confirmMerge = false" />
      <PConfirm :show="!!undoing" title="撤销合并？" message="后续资料或关联数据有变化时，将拒绝撤销以保护新数据。" @confirm="undoMerge" @cancel="undoing = null" />
    </PSheet>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, searchCatalogWorks } from '@/api/bookCatalog'
import { wikiHistory, wikiMetadata, patchWiki, revertWiki, previewWikiMerge, mergeWiki, revertWikiMerge, wikiMerges, searchWikiPeople, createWikiPerson, type WikiKind, type WikiRevision, type WikiMerge, type MergePreview } from '@/api/bookWiki'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
const props = defineProps<{ kind: WikiKind; entityId: string; authenticated: boolean; workId?: string }>()
const emit = defineEmits<{ changed: [] }>()
const label = computed(() => ({ work: '作品', person: '作者', edition: '出版版本' })[props.kind])
const opened = ref(false), loading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), conflicted = ref(false), head = ref(''), canonicalId = ref(props.entityId)
const values = ref<Record<string, string>>({}), summary = ref(''), original = ref(''), selectedIds = ref<string[]>([]), selectedPeople = ref<{ id: string; name: string }[]>([]), personQuery = ref(''), personResults = ref<{ id: string; name: string }[]>([])
const history = ref<WikiRevision[]>([]), historyTotal = ref(0), merges = ref<WikiMerge[]>([]), reverting = ref<WikiRevision | null>(null), undoing = ref<WikiMerge | null>(null), confirmMerge = ref(false), confirmClose = ref(false)
const targetQuery = ref(''), targetId = ref(''), targets = ref<{ id: string; name: string }[]>([]), mergePreview = ref<MergePreview | null>(null)
const fieldDefinitions = computed<{ key: string; label: string; type?: string }[]>(() => props.kind === 'person' ? [{ key: 'name', label: '作者姓名' }, { key: 'description', label: '作者简介' }] : props.kind === 'work' ? [{ key: 'title', label: '书名' }, { key: 'subtitle', label: '副标题' }, { key: 'original_title', label: '原作名' }, { key: 'description', label: '简介' }, { key: 'language', label: '语言代码' }] : [{ key: 'title', label: '版本名称' }, { key: 'publisher', label: '出版社' }, { key: 'producer', label: '出品方' }, { key: 'isbn10', label: 'ISBN-10' }, { key: 'isbn13', label: 'ISBN-13' }, { key: 'language', label: '语言代码' }, { key: 'published_date', label: '出版日期', type: 'date' }, { key: 'page_count', label: '页数', type: 'number' }, { key: 'binding', label: '装帧' }, { key: 'cover_url', label: '封面地址' }])
const serialized = () => JSON.stringify([values.value, selectedIds.value, summary.value])
const dirty = computed(() => opened.value && !!head.value && serialized() !== original.value)
let closeResolve: ((value: boolean) => void) | undefined
function formatValue(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value) }
function dateParts(value: string) { const [year = '', month = '', day = ''] = value.split('-'); return { year, month, day } }
async function open() { opened.value = true; await load() }
async function load() { loading.value = true; head.value = ''; error.value = ''; conflicted.value = false; mergePreview.value = null; try {
  let fields: Record<string, unknown>
  if (props.kind === 'work') { const work = await getCatalogWork(props.entityId); fields = { ...work }; head.value = work.revision_id; canonicalId.value = work.id; selectedPeople.value = work.authors; selectedIds.value = work.authors.map(person => person.id) }
  else { const metadata = await wikiMetadata(props.kind, props.entityId); fields = metadata.fields; head.value = metadata.revision_id; canonicalId.value = metadata.entity_id }
  values.value = Object.fromEntries(fieldDefinitions.value.map(field => [field.key, field.type === 'date' ? String(fields[field.key] || '').slice(0, 10) : String(fields[field.key] ?? '')])); summary.value = ''; original.value = serialized()
  const page = await wikiHistory(props.kind, canonicalId.value); history.value = page.items; historyTotal.value = page.total
  merges.value = (await wikiMerges(props.kind, props.entityId)).items
 } catch { error.value = '资料或修订历史加载失败，请重试。' } finally { loading.value = false } }
async function save() { if (busy.value || conflicted.value) return; busy.value = true; error.value = ''; try { const fields: Record<string, unknown> = { ...values.value }; if (props.kind === 'work') fields.author_ids = selectedIds.value; if (props.kind === 'edition') { fields.page_count = Number(fields.page_count || 0); fields.published_date = String(fields.published_date || '').replaceAll('-', '') ? `${fields.published_date}T00:00:00Z` : null }; await patchWiki(props.kind, canonicalId.value, head.value, fields, summary.value); emit('changed'); await load(); notice.value = '资料已公开，修订历史已保留。' } catch (err) { conflicted.value = err instanceof ApiErrorResponseError && err.status === 409; error.value = '保存失败，输入仍保留。请检查内容或基础修订后重试。' } finally { busy.value = false } }
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
