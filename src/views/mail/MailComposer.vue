<template>
  <PSheet :show="true" title="写邮件" mode="full" close-type="header" @close="closeComposer">
    <form class="mail-compose" @submit.prevent="sendMessage">
      <div class="mail-compose__identity">发件人 <strong>{{ address }}</strong><span role="status">{{ saving ? '正在保存…' : dirty ? '有未保存内容' : '草稿已保存' }}</span></div>
      <label>收件人<input v-model="toText" type="text" placeholder="收件人邮箱，多个地址用逗号分隔" aria-label="收件人" :disabled="contentLocked" /></label>
      <div class="mail-compose__copies"><label>抄送<input v-model="ccText" type="text" placeholder="抄送邮箱" aria-label="抄送" :disabled="contentLocked" /></label><label>密送<input v-model="bccText" type="text" placeholder="密送邮箱" aria-label="密送" :disabled="contentLocked" /></label></div>
      <label>主题<input v-model="subject" type="text" placeholder="邮件主题" maxlength="998" aria-label="邮件主题" :disabled="contentLocked" /></label>
      <div class="mail-compose__format"><button type="button" :disabled="contentLocked" :aria-pressed="!rich" @click="setRich(false)">纯文本</button><button type="button" :disabled="contentLocked" :aria-pressed="rich" @click="setRich(true)">格式文本</button><template v-if="rich"><button type="button" :disabled="contentLocked" aria-label="加粗" @mousedown.prevent="format('bold')"><strong>B</strong></button><button type="button" :disabled="contentLocked" aria-label="斜体" @mousedown.prevent="format('italic')"><em>I</em></button><button type="button" :disabled="contentLocked" aria-label="项目符号" @mousedown.prevent="format('insertUnorderedList')">列表</button><button type="button" :disabled="contentLocked" @mousedown.prevent="format('removeFormat')">清除格式</button></template></div>
      <div v-if="rich" ref="editor" class="mail-compose__editor" :contenteditable="!contentLocked" role="textbox" aria-label="邮件正文" aria-multiline="true" @input="captureRich" @paste="pastePlain"></div>
      <textarea v-else v-model="text" class="mail-compose__body" aria-label="邮件正文" placeholder="写下邮件内容…" :disabled="contentLocked"></textarea>
      <div class="mail-compose__attachments"><div v-for="item in attachments" :key="item.id"><Paperclip :size="15" /><span>{{ item.name }} · {{ fileSize(item.size) }}</span><button type="button" :aria-label="`移除附件 ${item.name}`" :disabled="contentLocked" @click="attachments = attachments.filter(file => file.id !== item.id)"><X :size="15" /></button></div></div>
      <p v-if="warning" role="alert" class="mail-compose__error">{{ warning }}</p><p v-if="error" role="alert" class="mail-compose__error">{{ error }}</p><PButton v-if="conflicted" variant="secondary" :loading="saving" @click="saveAsCopy">另存为新草稿</PButton>
      <div class="mail-compose__actions"><PButton type="submit" :loading="sending" :disabled="uploading || sending || conflicted">{{ ambiguousSend ? '确认发送状态' : '发送' }}</PButton><label class="mail-compose__upload"><Paperclip :size="17" />{{ uploading ? '正在上传…' : '添加附件' }}<input type="file" multiple :disabled="uploading || contentLocked" @change="addAttachments" /></label><PButton type="button" variant="secondary" :disabled="sending || saving" @click="closeComposer">保存并关闭</PButton><button type="button" class="mail-compose__discard" :disabled="contentLocked || conflicted" @click="confirmDiscard = true">删除草稿</button></div>
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
import { deleteMailDraft, queueMail, saveMailDraft, uploadMailAttachment, type MailComposeFields, type MailDraft, type MailOutbox } from '@/api/mailClient'
import { fileSize, newRequestID, parseRecipients } from './mail-helpers'
const props = defineProps<{ address: string; draft: MailDraft; warning?: string }>()
const emit = defineEmits<{ close: []; saved: []; queued: [outbox: MailOutbox, draft: MailDraft] }>()
const toText = ref(props.draft.to.join(', ')), ccText = ref(props.draft.cc.join(', ')), bccText = ref(props.draft.bcc.join(', '))
const subject = ref(props.draft.subject), text = ref(props.draft.text), html = ref(props.draft.html || '')
const attachments = ref([...props.draft.attachments]), rich = ref(Boolean(html.value)), editor = ref<HTMLElement | null>(null)
const draftId = ref(props.draft.id), conflicted = ref(false), ambiguousSend = ref(false)
const saving = ref(false), sending = ref(false), uploading = ref(false), error = ref(''), confirmDiscard = ref(false)
const contentLocked = computed(() => sending.value || ambiguousSend.value)
const changedSnapshot = computed(() => JSON.stringify({ to: toText.value, cc: ccText.value, bcc: bccText.value, subject: subject.value, text: text.value, html: html.value, attachments: attachments.value }))
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
  return { to: strict ? parseRecipients(toText.value) : looseRecipients(toText.value), cc: strict ? parseRecipients(ccText.value) : looseRecipients(ccText.value), bcc: strict ? parseRecipients(bccText.value) : looseRecipients(bccText.value), subject: subject.value, text: text.value, html: rich.value ? html.value : undefined, attachments: [...attachments.value], in_reply_to: props.draft.in_reply_to, references: props.draft.references }
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
    const queued = await queueMail(content, submissionId, draftId.value, revision.value)
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
onMounted(async () => { try { ambiguousSend.value = Boolean(localStorage.getItem(`atoman.mail.send.${draftId.value}.${revision.value}`)); if (ambiguousSend.value) error.value = '这封草稿有待确认的发送记录，请先确认发送状态。' } catch { /* optional storage */ }; await nextTick(); if (editor.value) editor.value.innerHTML = DOMPurify.sanitize(html.value, { ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'], ALLOWED_ATTR: [] }); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { disposed = true; clearTimeout(saveTimer); window.removeEventListener('beforeunload', beforeUnload) })
</script>
<style scoped>
.mail-compose{padding:24px clamp(18px,5vw,68px);max-width:1100px;margin:0 auto;color:var(--a-color-fg)}
.mail-compose__identity{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--a-color-muted);padding-bottom:22px}.mail-compose__identity strong{font-weight:500;color:var(--a-color-fg)}.mail-compose__identity span{margin-left:auto}
.mail-compose label{display:flex;align-items:center;gap:18px;font-size:13px;border-bottom:1px solid var(--a-color-border-soft);padding:12px 0}.mail-compose input:not([type=file]){flex:1;min-width:0;border:0;background:transparent;color:inherit;font:inherit;padding:6px;outline-offset:3px}.mail-compose__copies{display:grid;grid-template-columns:1fr 1fr;gap:20px}.mail-compose__format{display:flex;gap:8px;padding:16px 0}.mail-compose__format button{border:1px solid var(--a-color-border-soft);border-radius:4px;background:transparent;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}.mail-compose__format button[aria-pressed=true]{background:var(--a-color-surface-muted);color:var(--a-color-primary)}
.mail-compose__body,.mail-compose__editor{display:block;width:100%;min-height:320px;border:0;background:transparent;color:inherit;font:15px/1.8 inherit;padding:8px;resize:vertical;outline:1px solid var(--a-color-border-soft);overflow-wrap:anywhere}.mail-compose__editor{font-size:15px;line-height:1.8}.mail-compose__attachments{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.mail-compose__attachments>div{display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--a-color-border-soft);font-size:12px}.mail-compose__attachments span{overflow-wrap:anywhere}.mail-compose__attachments button{border:0;background:none;color:var(--a-color-muted);cursor:pointer}.mail-compose__actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.mail-compose__upload{position:relative;border:0!important;cursor:pointer}.mail-compose__upload input{position:absolute;width:1px;height:1px;opacity:0}.mail-compose__discard{border:0;background:none;color:var(--a-color-danger);font-size:13px;cursor:pointer;margin-left:auto}.mail-compose__hint{font-size:12px;color:var(--a-color-muted)}.mail-compose__error{color:var(--a-color-danger);font-size:13px}
@media(max-width:600px){.mail-compose__copies{grid-template-columns:1fr;gap:0}.mail-compose__body,.mail-compose__editor{min-height:260px}.mail-compose__identity span{margin-left:0;width:100%}.mail-compose__actions{gap:10px}.mail-compose__discard{margin-left:0}}
</style>
