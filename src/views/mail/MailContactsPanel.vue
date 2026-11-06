<template>
  <section class="mail-contacts">
    <header class="mail-contacts__header">
      <div><h2>邮件联系人</h2><p>私人通讯录仅自己可见；写邮件时会自动推荐。</p></div>
      <div class="mail-contacts__header-actions">
        <PButton variant="ghost" size="sm" :disabled="loading || !items.length || importing" @click="download('csv')">导出 CSV</PButton>
        <PButton variant="ghost" size="sm" :disabled="loading || !items.length || importing" @click="download('vcf')">导出 vCard</PButton>
        <input ref="fileInput" class="mail-contacts__file" type="file" accept=".csv,.vcf,text/csv,text/vcard" aria-label="选择 CSV 或 vCard 联系人文件" @change="loadFile" />
        <PButton variant="secondary" size="sm" :disabled="loading || importing" @click="fileInput?.click()"><Upload :size="15" /> 导入</PButton>
        <PButton size="sm" :disabled="importing" @click="openNew"><Plus :size="15" /> 新建联系人</PButton>
      </div>
    </header>
    <PSearchInput v-model="search" variant="inline" size="sm" aria-label="搜索邮件联系人" placeholder="搜索姓名或邮箱" :show-shortcut-badge="false" :show-action-button="false" />
    <div v-if="loading" role="status" class="mail-contacts__hint">正在加载联系人…</div>
    <div v-if="error" role="alert" class="mail-contacts__error">{{ error }}</div>
    <p v-if="importNotice" role="status" class="mail-contacts__hint">{{ importNotice }}</p>
    <PEmpty v-if="!loading && !matches.length" compact :title="search ? '没有找到联系人' : '通讯录还是空的'" :description="search ? '试试其他姓名或地址。' : '保存常用邮箱后，写信时就能自动补全。'" />
    <div v-for="item in matches" :key="item.id" class="mail-contacts__item">
      <div><strong>{{ item.name || item.email }}</strong><small>{{ item.email }}</small></div>
      <PButton variant="ghost" size="sm" :aria-label="'编辑 '+item.email" @click="openEdit(item)"><Pencil :size="16" /></PButton>
      <PButton variant="ghost" size="sm" :aria-label="'删除 '+item.email" @click="deleteTarget = item"><Trash2 :size="16" /></PButton>
    </div>
  </section>
  <PModal :show="editing" :title="form.id ? '编辑联系人' : '新建联系人'" size="md" @close="editing = false">
    <form class="mail-contacts__form" @submit.prevent="save">
      <PInput v-model="form.name" label="姓名" placeholder="备注姓名（可留空）" maxlength="120" />
      <PInput v-model="form.email" label="邮箱地址" type="email" placeholder="name@example.com" required maxlength="254" />
      <PTextarea v-model="form.notes" label="备注" :rows="2" maxlength="2048" placeholder="可选的私人备注" />
      <p v-if="formError" role="alert" class="mail-contacts__error">{{ formError }}</p>
      <div class="mail-contacts__actions"><PButton type="button" variant="secondary" @click="editing = false">取消</PButton><PButton type="submit" :loading="saving">保存联系人</PButton></div>
    </form>
  </PModal>
  <PModal :show="Boolean(importPreview)" title="预览导入联系人" size="md" :closable="!importing" @close="!importing && (importPreview = null)">
    <div class="mail-contacts__import-preview">
      <p>文件中有 <strong>{{ importPreview?.rows.length }}</strong> 个不同邮箱，{{ importPreview?.duplicateRows }} 条文件内重复，{{ existingCount }} 条已在通讯录。</p>
      <p>预计新增 <strong>{{ importCandidates.length }}</strong> 条；已存在的联系人将跳过，不会被修改。</p>
      <p v-if="items.length + importCandidates.length > 500" role="alert" class="mail-contacts__error">通讯录最多 500 条，请先删除部分联系人再导入。</p>
      <ol v-if="importCandidates.length" class="mail-contacts__sample">
        <li v-for="item in importCandidates.slice(0, 5)" :key="item.email">{{ item.name || '未填写姓名' }} · {{ item.email }}</li>
      </ol>
      <p v-if="importCandidates.length > 5" class="mail-contacts__hint">其余 {{ importCandidates.length - 5 }} 条联系人将在确认后导入。</p>
      <p v-if="importing" role="status">正在导入：{{ importedCount }} / {{ importCandidates.length + importedCount }}</p>
      <p v-if="importError" role="alert" class="mail-contacts__error">{{ importError }}</p>
    </div>
    <template #footer>
      <PButton variant="secondary" :disabled="importing" @click="importPreview = null">取消</PButton>
      <PButton :loading="importing" :disabled="!importCandidates.length || items.length + importCandidates.length > 500" @click="confirmImport">确认新增 {{ importCandidates.length }} 条</PButton>
    </template>
  </PModal>
  <PModal :show="Boolean(deleteTarget)" title="删除联系人" size="sm" @close="deleteTarget = null">
    <p>删除后，通讯录将不再推荐这个地址，但历史邮件不会受到影响。</p>
    <template #footer><PButton variant="secondary" @click="deleteTarget = null">取消</PButton><PButton variant="danger" :loading="saving" @click="remove">删除联系人</PButton></template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2, Upload } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSearchInput from '@/components/ui/PSearchInput.vue'
import { createMailContact, deleteMailContact, fetchMailContacts, updateMailContact, type MailContact } from '@/api/mailClient'
import { CONTACT_FILE_MAX_BYTES, exportContactsCSV, exportContactsVCard, parseContactFile, type ContactImport, type TransferContact } from './mail-contact-transfer'

const items = ref<MailContact[]>([])
const loading = ref(true), saving = ref(false), error = ref(''), formError = ref('')
const search = ref('')
const editing = ref(false), deleteTarget = ref<MailContact|null>(null)
const fileInput = ref<HTMLInputElement|null>(null)
const importPreview = ref<ContactImport|null>(null)
const importing = ref(false), importedCount = ref(0), importError = ref(''), importNotice = ref('')
const importedEmails = ref(new Set<string>())
const knownEmails = computed(() => new Set(items.value.map(item => item.email.trim().toLowerCase())))
const importCandidates = computed(() => (importPreview.value?.rows || []).filter(item => !knownEmails.value.has(item.email) && !importedEmails.value.has(item.email)))
const existingCount = computed(() => (importPreview.value?.rows.length || 0) - importCandidates.value.length)

const form = ref<MailContact>({id:'',name:'',email:'',notes:'',revision:0,updated_at:''})
const matches = computed(() => items.value.filter(item => (item.name+' '+item.email).toLowerCase().includes(search.value.toLowerCase().trim())).slice(0,100))
const openNew = () => { form.value={id:'',name:'',email:'',notes:'',revision:0,updated_at:''};formError.value='';editing.value=true }
const openEdit = (item:MailContact) => { form.value={...item};formError.value='';editing.value=true }
async function refresh() {
 try { items.value = await fetchMailContacts(); error.value='' } catch { error.value='无法加载私人通讯录，请刷新重试。' } finally { loading.value=false }
}
async function save() {
 if(saving.value)return
 saving.value=true;formError.value=''
 try {
  const next = form.value.id ? await updateMailContact(form.value) : await createMailContact(form.value)
  items.value=[next,...items.value.filter(row=>row.id!==next.id)]
  editing.value=false
 } catch {formError.value='保存失败。可能是地址重复、输入无效或联系人已被其他设备修改。'}
 finally {saving.value=false}
}
async function remove() {
 if(!deleteTarget.value || saving.value)return
 saving.value=true;error.value=''
 try {await deleteMailContact(deleteTarget.value.id);items.value=items.value.filter(item=>item.id!==deleteTarget.value?.id);deleteTarget.value=null}
 catch {error.value='无法删除联系人，请重试。'}
 finally {saving.value=false}
}
async function loadFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  importError.value = ''; importNotice.value = ''; importedCount.value = 0; importedEmails.value = new Set()
  try {
    if (file.size > CONTACT_FILE_MAX_BYTES) throw new Error('文件不能超过 1 MB。')
    // Only read the file in this tab; the source file is never uploaded to Atoman.
    importPreview.value = parseContactFile(file.name, new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer()))
  } catch (cause) {
    importPreview.value = null
    error.value = cause instanceof TypeError ? '请使用 UTF-8 编码的 CSV 或 vCard 文件。' : cause instanceof Error ? cause.message : '无法读取联系人文件。'
  }
}
async function confirmImport() {
  if (importing.value || !importPreview.value || !importCandidates.value.length || items.value.length + importCandidates.value.length > 500) return
  importing.value = true; importError.value = ''; importedCount.value = 0
  const pending = importCandidates.value.slice()
  for (const row of pending) {
    try {
      const next = await createMailContact(row)
      items.value = [next, ...items.value.filter(item => item.id !== next.id)]
      importedEmails.value.add(row.email)
      importedCount.value++
    } catch {
      importError.value = `已导入 ${importedCount.value} 条；后续未完成。可能是网络、重复联系人或通讯录数量限制，请检查后重试，已成功的联系人不会再次导入。`
      await refresh()
      break
    }
  }
  importing.value = false
  if (!importError.value) {
    importNotice.value = `已成功导入 ${importedCount.value} 条联系人，重复地址已跳过。`
    importPreview.value = null
  }
}
function download(format: 'csv'|'vcf') {
  if (loading.value || !items.value.length) return
  const rows: TransferContact[] = items.value.map(({name,email,notes}) => ({name,email,notes}))
  const content = format === 'csv' ? exportContactsCSV(rows) : exportContactsVCard(rows)
  const blob = new Blob([content], {type:format === 'csv' ? 'text/csv;charset=utf-8' : 'text/vcard;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = format === 'csv' ? 'atoman-mail-contacts.csv' : 'atoman-mail-contacts.vcf'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
onMounted(refresh)
</script>
<style scoped>
.mail-contacts { display:grid;gap:16px; }
.mail-contacts__header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px; }
.mail-contacts__header h2 {margin:0 0 7px;font-size:18px;font-weight:600;}
.mail-contacts__header p {margin:0;color:var(--a-color-muted);font-size:13px;line-height:1.5;}
.mail-contacts__item {display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--a-color-border-soft);}
.mail-contacts__item > div {display:grid;gap:5px;flex:1;min-width:0;}
.mail-contacts__item strong {font-size:13px;font-weight:600;overflow-wrap:anywhere;}
.mail-contacts__item small {font-size:12px;color:var(--a-color-muted);overflow-wrap:anywhere;}
.mail-contacts__form {display:grid;gap:17px;padding-top:15px;}
.mail-contacts__actions {display:flex;justify-content:flex-end;gap:10px;}
.mail-contacts__error {color:var(--a-color-danger);font-size:13px;}
.mail-contacts__hint {font-size:13px;color:var(--a-color-muted);}
.mail-contacts__header .p-button {display:inline-flex;align-items:center;gap:6px;}
.mail-contacts__header-actions {display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;}
.mail-contacts__file {display:none;}
.mail-contacts__import-preview {display:grid;gap:12px;font-size:13px;line-height:1.7;}
.mail-contacts__import-preview p {margin:0;}
.mail-contacts__sample {margin:0;padding:10px 12px 10px 32px;max-height:185px;overflow:auto;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control);background:var(--a-color-surface);font-size:12px;}
.mail-contacts__sample li {overflow-wrap:anywhere;}

.mail-contacts :deep(.p-search-input) {display:flex;width:100%;height:40px;}
</style>
