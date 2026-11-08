<template>
  <PSheet :show="true" title="写邮件" mode="full" close-type="header" @close="closeComposer">
    <form class="mail-compose" @submit.prevent="sendMessage">
      <div class="mail-compose__identity"><div><label for="mail-sender">发件人</label><select id="mail-sender" v-model="selectedSender" :disabled="contentLocked" aria-label="发件人" data-testid="mail-sender-select"><option value="">{{ address }}（Atoman）</option><option v-for="sender in externalSenders" :key="sender.alias_id || sender.external_account_id" :value="sender.alias_id ? `alias:${sender.alias_id}` : sender.external_account_id">{{ sender.address }}（{{ sender.provider==='atoman-alias'?'Atoman 别名':sender.provider }}）</option><option v-if="senderMissing" :value="selectedSender" disabled>原发件地址已停用或不可用，请重新选择</option></select></div><PBadge role="status" :type="dirty ? 'warning' : 'success'" :label="saving ? '正在保存…' : dirty ? '有未保存内容' : '草稿已保存'" /></div>
      <MailRecipientField v-model="toText" label="收件人" placeholder="收件人邮箱，多个地址用逗号分隔" :contacts="contacts" :disabled="contentLocked" />
      <div class="mail-compose__copies"><MailRecipientField v-model="ccText" label="抄送" placeholder="抄送邮箱" :contacts="contacts" :disabled="contentLocked" /><MailRecipientField v-model="bccText" label="密送" placeholder="密送邮箱" :contacts="contacts" :disabled="contentLocked" /></div>
      <PInput v-model="subject" label="主题" type="text" placeholder="邮件主题" maxlength="998" aria-label="邮件主题" :disabled="contentLocked" />
      <div class="mail-compose__format">
        <PSegmentedControl :model-value="rich ? 'rich' : 'plain'" :options="[{ label: '纯文本', value: 'plain' }, { label: '格式文本', value: 'rich' }]" :disabled="contentLocked" @update:model-value="setRich($event === 'rich')" />
        <div v-if="rich" class="mail-compose__format-tools"><PButton type="button" variant="ghost" size="sm" :disabled="contentLocked" aria-label="加粗" @mousedown.prevent="format('bold')"><strong>B</strong></PButton><PButton type="button" variant="ghost" size="sm" :disabled="contentLocked" aria-label="斜体" @mousedown.prevent="format('italic')"><em>I</em></PButton><PButton type="button" variant="ghost" size="sm" :disabled="contentLocked" aria-label="项目符号" @mousedown.prevent="format('insertUnorderedList')">列表</PButton><PButton type="button" variant="ghost" size="sm" :disabled="contentLocked" @mousedown.prevent="format('removeFormat')">清除格式</PButton></div>
      </div>
      <div v-if="rich" ref="editor" class="mail-compose__editor" :contenteditable="!contentLocked" role="textbox" aria-label="邮件正文" aria-multiline="true" @input="captureRich" @paste="pastePlain"></div>
      <PTextarea v-else v-model="text" class="mail-compose__body" label="正文" aria-label="邮件正文" :rows="13" placeholder="写下邮件内容…" :disabled="contentLocked" />
      <div class="mail-compose__schedule">
        <label class="mail-settings__check"><input v-model="scheduleMode" type="checkbox" :disabled="contentLocked" />定时发送</label>
        <PDatetimePicker v-if="scheduleMode" v-model="scheduledLocal" label="发送时间（本地时区）" :disabled="contentLocked" />
        <p v-if="scheduleMode">发件将在所选时间由服务器自动执行；发送前可以取消。</p>
      </div>
      <div class="mail-compose__attachments"><div v-for="item in attachments" :key="item.id"><Paperclip :size="15" /><span>{{ item.name }} · {{ fileSize(item.size) }}</span><button type="button" :aria-label="`移除附件 ${item.name}`" :disabled="contentLocked" @click="attachments = attachments.filter(file => file.id !== item.id)"><X :size="15" /></button></div></div>
      <p v-if="warning" role="alert" class="mail-compose__error">{{ warning }}</p><p v-if="error" role="alert" class="mail-compose__error">{{ error }}</p><PButton v-if="conflicted" variant="secondary" :loading="saving" @click="saveAsCopy">另存为新草稿</PButton>
      <div class="mail-compose__actions"><PButton type="submit" :loading="sending" :disabled="uploading || sending || conflicted">{{ ambiguousSend ? '确认发送状态' : scheduleMode ? '确认定时发送' : '发送' }}</PButton><PButton tag="label" variant="secondary" class="mail-compose__upload" :disabled="uploading || contentLocked"><Paperclip :size="17" />{{ uploading ? '正在上传…' : '添加附件' }}<input type="file" multiple :disabled="uploading || contentLocked" @change="addAttachments" /></PButton><PButton type="button" variant="secondary" :disabled="sending || saving" @click="closeComposer">保存并关闭</PButton><PButton type="button" variant="ghost" class="mail-compose__discard" :disabled="contentLocked || conflicted" @click="confirmDiscard = true">删除草稿</PButton></div>
      <p class="mail-compose__hint">发送后有 5 秒可以撤销。</p>
    </form>
  </PSheet>
  <PModal v-if="confirmDiscard" :show="confirmDiscard" title="删除草稿" size="sm" @close="confirmDiscard = false"><p>删除这封尚未发送的邮件？</p><template #footer><PButton variant="secondary" @click="confirmDiscard = false">保留草稿</PButton><PButton variant="danger" @click="discard">删除</PButton></template></PModal>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { Paperclip, X } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PDatetimePicker from '@/components/ui/PDatetimePicker.vue'
import MailRecipientField from './MailRecipientField.vue'
import { fetchMailContacts, fetchMailPreferences, fetchMailSenders, type MailContact, type MailSenderIdentity } from '@/api/mailClient'
import { deleteMailDraft, queueMail, saveMailDraft, uploadMailAttachment, type MailComposeFields, type MailDraft, type MailOutbox } from '@/api/mailClient'
import { fileSize, newRequestID, parseRecipients } from './mail-helpers'
const props = defineProps<{ address: string; draft: MailDraft; warning?: string }>()
const emit = defineEmits<{ close: []; saved: []; queued: [outbox: MailOutbox, draft: MailDraft] }>()
const contacts = ref<MailContact[]>([])
const externalSenders=ref<MailSenderIdentity[]>([])
const senderLoaded=ref(false)
const selectedSender=ref(props.draft.alias_id ? `alias:${props.draft.alias_id}` : props.draft.external_account_id || '')
const senderMissing=computed(()=>Boolean(selectedSender.value) && senderLoaded.value && !externalSenders.value.some(row=>row.alias_id ? selectedSender.value===`alias:${row.alias_id}` : selectedSender.value===row.external_account_id))
async function loadSenderChoices(){
  try {externalSenders.value=(await fetchMailSenders()).filter(row=>Boolean(row.external_account_id || row.alias_id))}
  catch {externalSenders.value=[]}
  finally {senderLoaded.value=true}
}
const scheduleMode = ref(Boolean(props.draft.send_at))
const scheduledLocal = ref(props.draft.send_at ? toLocalDateTime(props.draft.send_at) : '')
function toLocalDateTime(iso:string) {
  const d=new Date(iso)
  if(!Number.isFinite(d.getTime()))return ''
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000)
  return local.toISOString().slice(0,16)
}
function getSendAt():string|undefined {
  if(!scheduleMode.value)return undefined
  const stamp=Date.parse(scheduledLocal.value)
  if(!Number.isFinite(stamp) || stamp <= Date.now()+5000 || stamp > Date.now()+90*86400000) throw new Error('请选择 5 秒后至 90 天内的有效发送时间。')
  return new Date(stamp).toISOString()
}

const toText = ref(props.draft.to.join(', ')), ccText = ref(props.draft.cc.join(', ')), bccText = ref(props.draft.bcc.join(', '))
const subject = ref(props.draft.subject), text = ref(props.draft.text), html = ref(props.draft.html || '')
const attachments = ref([...props.draft.attachments]), rich = ref(Boolean(html.value)), editor = ref<HTMLElement | null>(null)
const draftId = ref(props.draft.id), conflicted = ref(false), ambiguousSend = ref(false)
const saving = ref(false), sending = ref(false), uploading = ref(false), error = ref(''), confirmDiscard = ref(false)
const contentLocked = computed(() => sending.value || ambiguousSend.value)
const changedSnapshot = computed(() => JSON.stringify({ to: toText.value, cc: ccText.value, bcc: bccText.value, subject: subject.value, text: text.value, html: html.value, attachments: attachments.value, sender: selectedSender.value, sendAt: scheduleMode.value ? scheduledLocal.value : null }))
const initiallyEmpty = !props.draft.subject && !props.draft.text && !props.draft.html && !props.draft.to.length && !props.draft.cc.length && !props.draft.bcc.length && !props.draft.attachments.length
const savedSnapshot = ref(props.draft.updated_at || initiallyEmpty ? changedSnapshot.value : '')
const revision = ref(props.draft.revision || 0), updatedAt = ref(props.draft.updated_at || '')
const dirty = computed(() => savedSnapshot.value !== changedSnapshot.value)
let saveTimer: ReturnType<typeof setTimeout> | undefined
let savePromise: Promise<void> | undefined
let disposed = false, discarding = false
let submissionId = newRequestID(), submissionSnapshot = ''
function looseRecipients(value: string) { return value.split(/[,;\n，；]+/).map(v => v.trim()).filter(Boolean) }
function fields(strict = false): MailComposeFields {
  return { ...(selectedSender.value.startsWith('alias:') ? {alias_id:selectedSender.value.slice(6)} : selectedSender.value ? {external_account_id:selectedSender.value}: {}), to: strict ? parseRecipients(toText.value) : looseRecipients(toText.value), cc: strict ? parseRecipients(ccText.value) : looseRecipients(ccText.value), bcc: strict ? parseRecipients(bccText.value) : looseRecipients(bccText.value), subject: subject.value, text: text.value, html: rich.value ? html.value : undefined, attachments: [...attachments.value], send_at: scheduleMode.value && scheduledLocal.value ? new Date(scheduledLocal.value).toISOString() : undefined, in_reply_to: props.draft.in_reply_to, references: props.draft.references }
}
async function persist() {
  if (discarding || disposed) return
  if (conflicted.value) throw new Error('草稿已在另一处更新，请另存为新草稿。')
  if (savePromise) { await savePromise; if (dirty.value) await persist(); return }
  if (!dirty.value) return
  const snapshot = changedSnapshot.value
  saving.value = true
  savePromise = (async () => {
    try { const saved = await saveMailDraft({ id: draftId.value, revision: revision.value, ...fields() }); revision.value = saved.revision || revision.value + 1; updatedAt.value = saved.updated_at || ''; savedSnapshot.value = snapshot; error.value = ''; emit('saved') }
    catch (cause) { conflicted.value = cause instanceof ApiErrorResponseError && cause.status === 409; error.value = conflicted.value ? '草稿已在另一处更新。当前内容已保留，请另存为新草稿后继续。' : '草稿保存失败，请保持页面打开后重试。'; throw new Error(error.value) }
    finally { saving.value = false }
  })()
  try { await savePromise } finally { savePromise = undefined }
  if (dirty.value && !discarding && !disposed) await persist()
}
watch(changedSnapshot, () => {
  clearTimeout(saveTimer)
  if (submissionSnapshot && submissionSnapshot !== changedSnapshot.value) { submissionId = newRequestID(); submissionSnapshot = '' }
  if (conflicted.value) return
  saveTimer = setTimeout(() => { void persist().catch(() => {}) }, 900)
})
async function closeComposer() {
  if (sending.value || uploading.value) return
  clearTimeout(saveTimer)
  try { await persist(); emit('close') } catch { /* Keep editor open for retry. */ }
}
async function saveAsCopy() {
  draftId.value = newRequestID(); revision.value = 0; updatedAt.value = ''; savedSnapshot.value = ''; conflicted.value = false
  try { await persist() } catch { /* Retain current contents for retry. */ }
}
async function discard() {
  discarding = true; clearTimeout(saveTimer)
  if (savePromise) await savePromise.catch(() => {})
  try { if (revision.value) await deleteMailDraft(draftId.value); emit('saved'); emit('close') } catch { discarding = false; error.value = '无法删除草稿，请重试。' }
}
async function sendMessage() {
  if (sending.value || uploading.value || conflicted.value) return
  let queueAttempted = false
  try {
    if(senderMissing.value) throw new Error('原发件地址已停用或不可用，请重新选择发件人。')
    const sendAt=getSendAt()
    const content = fields(true)
    if (!content.to.length && !content.cc.length && !content.bcc.length) throw new Error('请填写至少一个收件人、抄送或密送地址。')
    if (content.to.length + content.cc.length + content.bcc.length > 50) throw new Error('请将收件人总数控制在 50 人以内。')
    if (!content.text.trim() && !content.attachments.length) throw new Error('请填写邮件正文或添加附件。')
    sending.value = true; error.value = ''; clearTimeout(saveTimer)
    await persist()
    submissionSnapshot = changedSnapshot.value
    const sendKey = `atoman.mail.send.${draftId.value}.${revision.value}`
    try { submissionId = localStorage.getItem(sendKey) || submissionId; localStorage.setItem(sendKey, submissionId) } catch { /* In-memory retries still preserve this submission. */ }
    // The same request ID is retried after an ambiguous response; the server owns deduplication.
    queueAttempted = true; ambiguousSend.value = true
    const queued = await queueMail(content, submissionId, draftId.value, revision.value, sendAt)
    ambiguousSend.value = false
    if (queued.status === 'cancelled' || queued.status === 'blocked') { try { localStorage.removeItem(sendKey) } catch { /* optional storage */ }; submissionId = newRequestID(); error.value = queued.status === 'cancelled' ? '上次发送已撤销，请再次点击发送。' : '上次邮件未发出，请检查后再次发送。'; return }
    emit('queued', queued, { id: draftId.value, revision: revision.value, updated_at: updatedAt.value, ...content })
    emit('close')
  } catch (cause) {
    if (queueAttempted && cause instanceof ApiErrorResponseError && [400, 401, 403, 413, 422, 429].includes(cause.status)) {
      ambiguousSend.value = false
      try { localStorage.removeItem(`atoman.mail.send.${draftId.value}.${revision.value}`) } catch { /* optional storage */ }
      error.value = '邮件未提交，请检查收件人和附件后重试。'
    } else if (queueAttempted) error.value = '发送结果尚未确认，内容已暂时锁定。请点击「确认发送状态」，或保存关闭后检查发送状态。'
    else if (!error.value) error.value = cause instanceof Error ? cause.message : '邮件尚未提交，请重试。'
  }
  finally { sending.value = false }
}
async function addAttachments(event: Event) {
  const input = event.target as HTMLInputElement, files = Array.from(input.files || [])
  input.value = ''
  if (files.some(file => file.size > 10 * 1024 * 1024 || file.size === 0)) { error.value = '每个附件需大于 0 字节且不超过 10 MB。'; return }
  if (attachments.value.length + files.length > 20 || [...attachments.value, ...files].reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) { error.value = '每封邮件最多添加 20 个附件，总大小不超过 25 MB。'; return }
  uploading.value = true; error.value = ''
  try { for (const file of files) attachments.value.push(await uploadMailAttachment(file)); await persist() }
  catch { error.value = '部分附件上传失败，请检查附件清单后重试。' }
  finally { uploading.value = false }
}
function captureRich() { if (editor.value) { text.value = editor.value.innerText; html.value = DOMPurify.sanitize(editor.value.innerHTML, { ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'], ALLOWED_ATTR: [] }) } }
function format(command: string) { editor.value?.focus(); document.execCommand(command); captureRich() }
function pastePlain(event: ClipboardEvent) { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || ''); captureRich() }
async function setRich(enabled: boolean) {
  rich.value = enabled
  if (enabled) { await nextTick(); if (editor.value) editor.value.innerText = text.value; captureRich() } else html.value = ''
}
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || uploading.value || sending.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(async () => { if (sending.value || uploading.value) return false; try { await persist(); return true } catch { return false } })
// Load only the current user's private contacts and encrypted signature.
// Never overwrite a draft that has been saved or edited while loading.
async function loadComposerEnhancements(){
 try {contacts.value=await fetchMailContacts()} catch {contacts.value=[]}
 try {
  const prefs=await fetchMailPreferences()
  const sig=prefs.signature
  if (!sig?.enabled || revision.value!==0 || text.value!==props.draft.text || subject.value!==props.draft.subject) return
  if (props.draft.in_reply_to && !sig.on_reply) return
  const lines=sig.text?.trim()
  if (!lines) return
  const block='\n\n--\n'+lines+'\n'
  if(props.draft.in_reply_to && text.value.trim()) text.value=block+text.value
  else text.value=(text.value.trim() ? text.value.trim() : '')+block
  // Rich signature is sanitized locally before the existing draft sanitizer.
  if (rich.value && sig.html) {
   const safe=DOMPurify.sanitize(sig.html,{ALLOWED_TAGS:['p','br','div','strong','b','em','i','u','ul','ol','li'],ALLOWED_ATTR:[]})
   html.value=safe+html.value
   if(editor.value)editor.value.innerHTML=html.value
  }
 } catch {/* Signature lookup is optional; do not block composing. */}
}
onMounted(async () => { try { ambiguousSend.value = Boolean(localStorage.getItem(`atoman.mail.send.${draftId.value}.${revision.value}`)); if (ambiguousSend.value) error.value = '这封草稿有待确认的发送记录，请先确认发送状态。' } catch { /* optional storage */ }; await nextTick(); if (editor.value) editor.value.innerHTML = DOMPurify.sanitize(html.value, { ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'], ALLOWED_ATTR: [] }); window.addEventListener('beforeunload', beforeUnload); void loadComposerEnhancements(); void loadSenderChoices() })
onBeforeUnmount(() => { disposed = true; clearTimeout(saveTimer); window.removeEventListener('beforeunload', beforeUnload) })
</script>
<style scoped>
.mail-compose { display:grid; gap:20px; max-width:960px; margin:0 auto; padding:28px clamp(18px,5vw,60px) 74px; color:var(--a-color-fg); }
.mail-compose__identity { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding-bottom:16px; border-bottom:1px solid var(--a-color-border-soft); }
.mail-compose__identity > div { display:flex; align-items:center; gap:12px; min-width:0; color:var(--a-color-muted); font-size:12px; }
.mail-compose__identity strong { color:var(--a-color-fg); font-weight:600; overflow-wrap:anywhere; }
.mail-compose__identity select{max-width:min(100%,420px);min-height:36px;padding:5px 9px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control);color:var(--a-color-fg);background:var(--a-color-bg);font:inherit;font-size:13px}
.mail-compose__identity select:focus-visible{outline:2px solid var(--a-color-primary);outline-offset:2px}
.mail-compose__copies { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.mail-compose__format { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }
.mail-compose__format-tools { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.mail-compose__editor { display:block; min-height:310px; width:100%; padding:16px; border:1px solid var(--a-color-border-soft); border-radius:var(--a-radius-control); background:var(--a-color-bg); color:var(--a-color-fg); font-size:14px; line-height:1.85; font-family:inherit; overflow-wrap:anywhere; }
.mail-compose__editor:focus-visible { outline:2px solid var(--a-color-primary); outline-offset:2px; }
.mail-compose__body :deep(.p-textarea) { min-height:310px; line-height:1.85; resize:vertical; }
.mail-compose__schedule {display:grid;gap:10px;align-items:start;}
.mail-compose__schedule label {display:flex;align-items:center;gap:9px;font-size:13px;cursor:pointer;}
.mail-compose__schedule input[type=checkbox] {width:16px;height:16px;accent-color:var(--a-color-primary);}
.mail-compose__schedule p {margin:0;color:var(--a-color-muted);font-size:12px;}
.mail-compose__attachments { display:flex; flex-wrap:wrap; gap:9px; }
.mail-compose__attachments > div { display:flex; align-items:center; gap:8px; max-width:100%; padding:9px 11px; border:1px solid var(--a-color-border-soft); border-radius:var(--a-radius-control); background:var(--a-color-surface); font-size:12px; }
.mail-compose__attachments span { min-width:0; overflow-wrap:anywhere; }
.mail-compose__attachments button { display:inline-flex; flex-shrink:0; border:0; padding:2px; background:transparent; color:var(--a-color-muted); cursor:pointer; }
.mail-compose__actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding-top:15px; border-top:1px solid var(--a-color-border-soft); }
.mail-compose__upload { position:relative; display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
.mail-compose__upload input { position:absolute; width:1px; height:1px; opacity:0; }
.mail-compose__discard { margin-left:auto; color:var(--a-color-danger); }
.mail-compose__hint { margin:-11px 0 0; font-size:12px; color:var(--a-color-muted); }
.mail-compose__error { margin:0; color:var(--a-color-danger); font-size:13px; }
@media(max-width:600px) {
 .mail-compose { padding:20px 16px 60px; gap:18px; }
 .mail-compose__copies { grid-template-columns:1fr; gap:18px; }
 .mail-compose__editor,.mail-compose__body :deep(.p-textarea) { min-height:240px; }
 .mail-compose__discard { margin-left:0; }
}
</style>
