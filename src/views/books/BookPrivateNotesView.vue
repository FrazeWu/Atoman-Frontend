<template>
  <section class="book-catalog private-books">
    <PPageHeader title="我的笔记" sub="私人笔记仅本人可见；发布会生成独立的公开博客副本" />
    <details><summary>跨书查看划线与批注</summary><BookPrivateHighlights /></details>
    <div class="private-books__toolbar">
      <label>搜索笔记<input v-model="query" type="search" @keyup.enter="load()" /></label>
      <label>私人标签<input v-model="tag" @keyup.enter="load()" /></label>
      <label><input v-model="trash" type="checkbox" @change="load()" />回收站（30 天）</label>
      <PButton variant="secondary" @click="load()">搜索</PButton>
      <PButton @click="create">写笔记</PButton>
      <PButton to="/books/annotations" variant="secondary">划线批注中心</PButton>
      <PButton variant="secondary" :disabled="busy" @click="backup('json')">备份 JSON</PButton>
      <PButton variant="secondary" :disabled="busy" @click="backup('markdown')">导出 Markdown ZIP</PButton>
      <label>恢复备份<input type="file" accept="application/json,.json" :disabled="busy" @change="readBackup" /></label>
    </div>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">正在加载笔记…</p>
    <p v-else-if="!notes.length">{{ trash ? '回收站为空。删除的笔记保留 30 天。' : '暂无笔记。可以写独立笔记，或在阅读器中保存划线和批注。' }}</p>
    <ul v-else class="book-catalog__list">
      <li v-for="note in notes" :key="note.id" class="book-catalog__row">
        <strong>{{ note.title || '未命名笔记' }}</strong><p class="private-books__body">{{ note.body }}</p>
        <span>{{ note.tags.join(' / ') }}</span>
        <div class="private-books__toolbar">
          <RouterLink :to="`/books/work/${note.work_id}`">图书详情</RouterLink>
          <template v-if="!trash"><PButton variant="secondary" @click="edit(note)">编辑</PButton><PButton variant="ghost" :disabled="busy" @click="preparePublish(note)">发布副本</PButton><PButton variant="ghost" :disabled="busy" @click="deleting = note">删除</PButton></template>
          <PButton v-else :disabled="busy" @click="restore(note)">恢复笔记</PButton>
        </div>
      </li>
    </ul>
    <PButton v-if="notes.length < total" :disabled="loading" variant="secondary" @click="load(true)">加载更多</PButton>
    <PSheet :show="!!draft" title="私人读书笔记" mode="full" teleport-mobile @close="requestClose">
      <form v-if="draft" class="private-books private-books__editor" @submit.prevent="save">
        <p>仅本人可见。划线和书签仍在对应文件的阅读器中管理。</p>
        <template v-if="draft.base_version === 0">
          <label>关联图书<input v-model="workQuery" type="search" /></label><PButton type="button" variant="secondary" @click="findWorks">搜索图书</PButton>
          <label>选择作品<select v-model="draft.work_id" required><option value="">请选择图书</option><option v-for="work in works" :key="work.id" :value="work.id">{{ work.title }}</option></select></label>
        </template>
        <label>标题<input v-model="draft.title" maxlength="255" :readonly="busy" /></label>
        <label>笔记正文<textarea v-model="draft.body" rows="14" maxlength="200000" :readonly="busy" /></label>
        <label>私人标签（逗号分隔）<input v-model="draftTags" :readonly="busy" /></label>
        <p v-if="editError" role="alert">{{ editError }}</p>
        <div class="private-books__toolbar"><PButton type="submit" :disabled="busy || !draft.work_id">{{ busy ? '正在保存…' : '保存私人笔记' }}</PButton><PButton type="button" variant="ghost" :disabled="busy" @click="requestClose">取消</PButton></div>
      </form>
    </PSheet>
    <PSheet :show="!!publishing" title="发布公开副本" mode="full" teleport-mobile @close="!busy && (publishing = null)">
      <div class="private-books private-books__editor">
        <p>将发布当前已保存的标题与正文。私人标签、划线和阅读进度不会公开；之后修改私人笔记不会改动博客副本。</p>
        <h2>{{ publishing?.title }}</h2><p class="private-books__body">{{ publishing?.body }}</p>
        <label>发布到博客频道<select v-model="channelId"><option value="">请选择自己的博客频道</option><option v-for="channel in channels" :key="channel.id" :value="channel.id">{{ channel.name }}</option></select></label>
        <label><input v-model="confirmPublic" type="checkbox" />我确认以上正文将对所有人公开</label>
        <p v-if="editError" role="alert">{{ editError }}</p>
        <PButton :disabled="busy || !channelId || !confirmPublic" @click="publish">{{ busy ? '正在发布…' : '发布独立副本' }}</PButton>
      </div>
    </PSheet>
    <PConfirm :show="confirmClose" title="放弃未保存的笔记？" message="输入尚未保存到云端。" @confirm="finishClose(true)" @cancel="finishClose(false)" />
    <PConfirm :show="!!deleting" title="删除私人笔记？" message="笔记会放入回收站，30 天内可以恢复。已发布的博客副本不受影响。" @confirm="remove" @cancel="deleting = null" />
    <PConfirm :show="!!pendingImport" title="恢复笔记备份？" message="只新增备份中的笔记；已有的不同内容不会被覆盖，会单独报告冲突。" @confirm="importBackup" @cancel="pendingImport = null" />
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { apiGet } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import { searchCatalogWorks } from '@/api/bookCatalog'
import type { BookPublicWork } from '@/api/books'
import { listPrivateNotes, savePrivateNote, deletePrivateNote, restorePrivateNote, exportPrivateNotes, importPrivateNotes, publishPrivateNote, downloadBookData, type PrivateNote, type NoteInput, type NoteBackup } from '@/api/bookPrivate'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import BookPrivateHighlights from '@/components/books/BookPrivateHighlights.vue'
import './bookCatalog.css'
import './bookPrivate.css'
const route = useRoute(), router = useRouter()
const notes = ref<PrivateNote[]>([]), total = ref(0), query = ref(''), tag = ref(''), trash = ref(false), loading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), editError = ref('')
const draft = ref<(NoteInput & { id: string }) | null>(null), draftTags = ref(''), original = ref('')
const works = ref<BookPublicWork[]>([]), workQuery = ref(''), deleting = ref<PrivateNote | null>(null)
const pendingImport = ref<(NoteBackup & { request_id: string }) | null>(null)
const publishing = ref<PrivateNote | null>(null), channels = ref<{ id: string; name: string }[]>([]), channelId = ref(''), confirmPublic = ref(false)
let publishRequest = '', loadSequence = 0, closeResolve: ((value: boolean) => void) | undefined
const confirmClose = ref(false)
const serialized = () => JSON.stringify([draft.value, draftTags.value])
const dirty = computed(() => !!draft.value && serialized() !== original.value)
async function load(append = false) { const seq = ++loadSequence; loading.value = true; error.value = ''; try { const page = await listPrivateNotes({ q: query.value, tag: tag.value, trash: trash.value, work_id: typeof route.query.work === 'string' ? route.query.work : undefined, offset: append ? notes.value.length : 0 }); if (seq === loadSequence) { notes.value = append ? [...notes.value, ...page.items] : page.items; total.value = page.total } } catch { if (seq === loadSequence) error.value = '笔记加载失败，请点击搜索重试。' } finally { if (seq === loadSequence) loading.value = false } }
function create() { draft.value = { id: crypto.randomUUID(), base_version: 0, work_id: String(route.query.work || ''), title: '', body: '', tags: [], ...(route.query.revision ? { source_revision_id: String(route.query.revision) } : {}) }; draftTags.value = ''; editError.value = ''; original.value = serialized(); void findWorks() }
function edit(note: PrivateNote) { draft.value = { id: note.id, base_version: note.version, work_id: note.work_id, source_revision_id: note.source_revision_id, title: note.title, body: note.body, tags: [...note.tags] }; draftTags.value = note.tags.join(', '); editError.value = ''; original.value = serialized() }
async function findWorks() { try { works.value = (await searchCatalogWorks(workQuery.value)).items } catch { editError.value = '图书搜索失败，请重试。' } }
async function save() { if (!draft.value || busy.value) return; busy.value = true; editError.value = ''; const { id, ...input } = draft.value; try { await savePrivateNote(id, { ...input, tags: draftTags.value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) }); draft.value = null; notice.value = '私人笔记已保存。'; await load() } catch { editError.value = '保存失败或云端已有新版本。输入仍保留，请勿覆盖其他设备的更改；可复制正文后重新加载。' } finally { busy.value = false } }
function requestClose(): Promise<boolean> { if (busy.value) return Promise.resolve(false); if (!dirty.value) { draft.value = null; return Promise.resolve(true) } confirmClose.value = true; return new Promise(resolve => { closeResolve = resolve }) }
function finishClose(value: boolean) { confirmClose.value = false; if (value) draft.value = null; closeResolve?.(value); closeResolve = undefined }
async function remove() { const note = deleting.value; deleting.value = null; if (!note || busy.value) return; busy.value = true; try { await deletePrivateNote(note); await load() } catch { error.value = '删除失败或笔记已更改，请重新加载后重试。' } finally { busy.value = false } }
async function restore(note: PrivateNote) { busy.value = true; try { await restorePrivateNote(note); await load(); notice.value = '笔记已恢复。' } catch { error.value = '恢复失败：请重新加载，超过 30 天的笔记不能恢复。' } finally { busy.value = false } }
async function backup(format: 'json' | 'markdown') { busy.value = true; error.value = ''; try { const data = await exportPrivateNotes(); if (format === 'json') downloadBookData(JSON.stringify(data, null, 2), 'atoman-notes.json', 'application/json'); else { const { default: JSZip } = await import('jszip'); const zip = new JSZip(); data.notes.forEach(note => zip.file(`${note.id}.md`, `# ${note.title}\n\n${note.body}\n\n标签：${note.tags.join(', ')}\n作品：${note.work_id}\n`)); downloadBookData(await zip.generateAsync({ type: 'blob' }), 'atoman-notes.zip') } } catch { error.value = '导出失败，请重试。' } finally { busy.value = false } }
async function readBackup(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { if (file.size > 8 * 1024 * 1024) throw Error(); const data = JSON.parse(await file.text()) as NoteBackup; if (data.schema_version !== 1 || !Array.isArray(data.notes) || !data.notes.length || data.notes.length > 500) throw Error(); pendingImport.value = { ...data, request_id: crypto.randomUUID() } } catch { error.value = '请选择有效的 Atoman JSON 备份，每批最多 500 条、8 MiB。' } input.value = '' }
async function importBackup() { if (!pendingImport.value || busy.value) return; busy.value = true; try { const result = await importPrivateNotes(pendingImport.value); notice.value = `新增 ${result.created.length} 条，跳过 ${result.skipped.length} 条，冲突 ${result.conflicts.length} 条（未覆盖）。`; pendingImport.value = null; await load() } catch { error.value = '导入失败，未确认的批次仍保留，可重试同一请求。' } finally { busy.value = false } }
async function preparePublish(note: PrivateNote) { publishing.value = note; channelId.value = ''; confirmPublic.value = false; publishRequest = crypto.randomUUID(); editError.value = ''; try { channels.value = await apiGet<{ id: string; name: string }[]>(`${useApiUrl()}/studio/channels`) } catch { editError.value = '无法加载自己的博客频道，请先在创作中心建立博客频道。' } }
async function publish() { if (!publishing.value || !confirmPublic.value || !channelId.value || busy.value) return; busy.value = true; try { const result = await publishPrivateNote(publishing.value, channelId.value, publishRequest); publishing.value = null; await router.push(result.target_path) } catch { editError.value = '发布未确认，请重试。私人笔记不会被改成公开。' } finally { busy.value = false } }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(() => draft.value ? requestClose() : !busy.value)
onMounted(() => { void load(); window.addEventListener('beforeunload', beforeUnload); if (route.query.new === '1') create() })
onBeforeUnmount(() => { loadSequence++; closeResolve?.(false); window.removeEventListener('beforeunload', beforeUnload) })
</script>
