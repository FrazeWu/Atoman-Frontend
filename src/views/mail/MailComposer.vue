<template>
  <PSheet
    :show="true"
    title="写邮件"
    mode="full"
    content-max-width="96rem"
    close-type="header"
    :side="side || (isMobile ? 'bottom' : 'right')"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-top-layer="isTopLayer"
    @close="closeComposer"
  >
    <form
      class="mail-compose"
      :class="{ 'is-dragging': isDraggingOver }"
      @submit.prevent="sendMessage"
      @dragenter="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- 拖拽上传文件提示浮层 -->
      <div v-if="isDraggingOver" class="mail-compose__drop-overlay">
        <Paperclip :size="32" />
        <p>松开鼠标添加附件</p>
      </div>

      <div class="mail-compose__content">
        <!-- 发件人与保存状态 -->
        <div class="mail-compose__identity">
          <div class="mail-compose__sender-box">
            <label for="mail-sender">发件人</label>
            <select
              id="mail-sender"
              v-model="selectedSender"
              :disabled="contentLocked"
              aria-label="发件人"
              data-testid="mail-sender-select"
            >
              <option value="">{{ address }}（Atoman）</option>
              <option
                v-for="sender in externalSenders"
                :key="sender.alias_id || sender.external_account_id"
                :value="sender.alias_id ? `alias:${sender.alias_id}` : sender.external_account_id"
              >
                {{ sender.address }}（{{ sender.provider === 'atoman-alias' ? 'Atoman 别名' : sender.provider }}）
              </option>
              <option v-if="senderMissing" :value="selectedSender" disabled>
                原发件地址已停用或不可用，请重新选择
              </option>
            </select>
          </div>
          <PBadge
            role="status"
            :type="dirty ? 'warning' : 'success'"
            :label="saving ? '正在保存…' : dirty ? '有未保存内容' : '草稿已保存'"
          />
        </div>

        <!-- 收件人行 + 抄送/密送开关 -->
        <div class="mail-compose__recipient-row">
          <div class="mail-compose__recipient-field">
            <MailRecipientField
              v-model="toText"
              label="收件人"
              placeholder="收件人邮箱，多个地址用逗号分隔"
              :contacts="contacts"
              :disabled="contentLocked"
            />
          </div>
          <div class="mail-compose__recipient-actions">
            <button
              type="button"
              class="mail-compose__pill-btn"
              :class="{ 'is-active': showCc }"
              :disabled="contentLocked"
              @click="showCc = !showCc"
            >
              抄送
            </button>
            <button
              type="button"
              class="mail-compose__pill-btn"
              :class="{ 'is-active': showBcc }"
              :disabled="contentLocked"
              @click="showBcc = !showBcc"
            >
              密送
            </button>
          </div>
        </div>

        <!-- 抄送与密送行（始终挂载在 DOM，保障单元测试与键盘操作） -->
        <div class="mail-compose__copies" :class="{ 'is-collapsed': !showCc && !showBcc }">
          <div v-show="showCc" class="mail-compose__copy-item">
            <MailRecipientField
              v-model="ccText"
              label="抄送"
              placeholder="抄送邮箱"
              :contacts="contacts"
              :disabled="contentLocked"
            />
          </div>
          <div v-show="showBcc" class="mail-compose__copy-item">
            <MailRecipientField
              v-model="bccText"
              label="密送"
              placeholder="密送邮箱"
              :contacts="contacts"
              :disabled="contentLocked"
            />
          </div>
        </div>

        <!-- 邮件主题 -->
        <PInput
          v-model="subject"
          label="主题"
          type="text"
          placeholder="邮件主题"
          maxlength="998"
          aria-label="邮件主题"
          :disabled="contentLocked"
          @keydown="handleComposerKeydown"
        />

        <!-- 排版格式切换与富文本工具栏 -->
        <div class="mail-compose__format-bar">
          <PSegmentedControl
            :model-value="rich ? 'rich' : 'plain'"
            :options="[{ label: '纯文本', value: 'plain' }, { label: '格式文本', value: 'rich' }]"
            :disabled="contentLocked"
            @update:model-value="setRich($event === 'rich')"
          />
          <div v-if="rich" class="mail-compose__format-tools">
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.bold }"
              :disabled="contentLocked"
              title="加粗 (Ctrl/Cmd + B)"
              aria-label="加粗"
              @mousedown.prevent="format('bold')"
            >
              <Bold :size="15" />
            </button>
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.italic }"
              :disabled="contentLocked"
              title="斜体 (Ctrl/Cmd + I)"
              aria-label="斜体"
              @mousedown.prevent="format('italic')"
            >
              <Italic :size="15" />
            </button>
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.underline }"
              :disabled="contentLocked"
              title="下划线 (Ctrl/Cmd + U)"
              aria-label="下划线"
              @mousedown.prevent="format('underline')"
            >
              <Underline :size="15" />
            </button>
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.strikeThrough }"
              :disabled="contentLocked"
              title="删除线"
              aria-label="删除线"
              @mousedown.prevent="format('strikeThrough')"
            >
              <Strikethrough :size="15" />
            </button>
            <span class="mail-compose__tool-divider" />
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.insertUnorderedList }"
              :disabled="contentLocked"
              title="无序列表"
              aria-label="无序列表"
              @mousedown.prevent="format('insertUnorderedList')"
            >
              <List :size="15" />
            </button>
            <button
              type="button"
              class="mail-compose__tool-btn"
              :class="{ 'is-active': activeFormats.insertOrderedList }"
              :disabled="contentLocked"
              title="有序列表"
              aria-label="有序列表"
              @mousedown.prevent="format('insertOrderedList')"
            >
              <ListOrdered :size="15" />
            </button>
            <button
              type="button"
              class="mail-compose__tool-btn"
              :disabled="contentLocked"
              title="清除格式"
              aria-label="清除格式"
              @mousedown.prevent="format('removeFormat')"
            >
              <RemoveFormatting :size="15" />
            </button>
          </div>
        </div>

        <!-- 正文编辑器（支持富文本/纯文本，支持快捷键发送与粘贴图片/附件） -->
        <div class="mail-compose__editor-wrap">
          <div
            v-if="rich"
            ref="editor"
            class="mail-compose__editor"
            :contenteditable="!contentLocked"
            role="textbox"
            aria-label="邮件正文"
            aria-multiline="true"
            @input="captureRich"
            @paste="onEditorPaste"
            @keyup="updateActiveFormats"
            @mouseup="updateActiveFormats"
            @keydown="handleComposerKeydown"
          />
          <PTextarea
            v-else
            v-model="text"
            class="mail-compose__body"
            label="正文"
            aria-label="邮件正文"
            :rows="13"
            placeholder="写下邮件内容，支持拖拽文件或粘贴截图作为附件…"
            :disabled="contentLocked"
            @paste="onEditorPaste"
            @keydown="handleComposerKeydown"
          />
        </div>

        <!-- 附件列表与上传状态 -->
        <div v-if="attachments.length || uploading" class="mail-compose__attachments-section">
          <div class="mail-compose__attachments-head">
            <span>附件（{{ attachments.length }}）</span>
            <small v-if="attachments.length">{{ fileSize(attachments.reduce((sum, f) => sum + f.size, 0)) }}</small>
          </div>
          <div class="mail-compose__attachments-grid">
            <div
              v-for="item in attachments"
              :key="item.id"
              class="mail-compose__attachment-card"
            >
              <Paperclip :size="15" class="mail-compose__attachment-icon" />
              <div class="mail-compose__attachment-info">
                <span class="mail-compose__attachment-name" :title="item.name">{{ item.name }}</span>
                <span class="mail-compose__attachment-size">{{ fileSize(item.size) }}</span>
              </div>
              <button
                type="button"
                class="mail-compose__attachment-remove"
                :aria-label="`移除附件 ${item.name}`"
                :disabled="contentLocked"
                title="移除"
                @click="attachments = attachments.filter(file => file.id !== item.id)"
              >
                <X :size="14" />
              </button>
            </div>
            <div v-if="uploading" class="mail-compose__attachment-card is-uploading">
              <RefreshCw :size="15" class="mail-spin" />
              <span>正在上传附件…</span>
            </div>
          </div>
        </div>

        <!-- 定时发送设置 -->
        <div class="mail-compose__schedule">
          <label class="mail-settings__check">
            <input v-model="scheduleMode" type="checkbox" :disabled="contentLocked" />
            定时发送
          </label>
          <PDatetimePicker
            v-if="scheduleMode"
            v-model="scheduledLocal"
            label="发送时间（本地时区）"
            :disabled="contentLocked"
          />
          <p v-if="scheduleMode">发件将在所选时间由服务器自动执行；发送前可以取消。</p>
        </div>

        <!-- 报错信息与冲突恢复 -->
        <p v-if="warning" role="alert" class="mail-compose__error">{{ warning }}</p>
        <p v-if="error" role="alert" class="mail-compose__error">{{ error }}</p>
        <PButton v-if="conflicted" variant="secondary" :loading="saving" @click="saveAsCopy">
          另存为新草稿
        </PButton>
      </div>

      <!-- 底部吸底操作栏 -->
      <footer class="mail-compose__footer">
        <div class="mail-compose__footer-left">
          <PButton
            type="submit"
            :loading="sending"
            :disabled="uploading || sending || conflicted"
          >
            {{ ambiguousSend ? '确认发送状态' : scheduleMode ? '确认定时发送' : '发送' }}
          </PButton>
          <PButton
            tag="label"
            variant="secondary"
            class="mail-compose__upload"
            :disabled="uploading || contentLocked"
          >
            <Paperclip :size="16" />
            {{ uploading ? '正在上传…' : '添加附件' }}
            <input
              type="file"
              multiple
              :disabled="uploading || contentLocked"
              @change="addAttachments"
            />
          </PButton>
          <span class="mail-compose__shortcut-tip">Cmd/Ctrl + Enter 发送</span>
        </div>
        <div class="mail-compose__footer-right">
          <PButton
            type="button"
            variant="secondary"
            :disabled="sending || saving"
            @click="closeComposer"
          >
            保存并关闭
          </PButton>
          <PButton
            type="button"
            variant="ghost"
            class="mail-compose__discard"
            :disabled="contentLocked || conflicted"
            @click="confirmDiscard = true"
          >
            删除草稿
          </PButton>
        </div>
      </footer>
    </form>
  </PSheet>
  <PModal v-if="confirmDiscard" :show="confirmDiscard" title="删除草稿" size="sm" @close="confirmDiscard = false">
    <p>删除这封尚未发送的邮件？</p>
    <template #footer>
      <PButton variant="secondary" @click="confirmDiscard = false">保留草稿</PButton>
      <PButton variant="danger" @click="discard">删除</PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { Bold, Italic, List, ListOrdered, Paperclip, RefreshCw, RemoveFormatting, Strikethrough, Underline, X } from 'lucide-vue-next'
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
import { isStandaloneMobileApp } from '@/utils/appRuntime'

const isMobile = computed(isStandaloneMobileApp)

const props = withDefaults(
  defineProps<{
    address: string
    draft: MailDraft
    warning?: string
    layerIndex?: number
    stackSize?: number
    isTopLayer?: boolean
    side?: 'right' | 'bottom'
  }>(),
  {
    warning: undefined,
    layerIndex: undefined,
    stackSize: 1,
    isTopLayer: true,
    side: undefined,
  }
)
const emit = defineEmits<{ close: []; saved: []; queued: [outbox: MailOutbox, draft: MailDraft] }>()
const contacts = ref<MailContact[]>([])
const externalSenders = ref<MailSenderIdentity[]>([])
const senderLoaded = ref(false)
const selectedSender = ref(props.draft.alias_id ? `alias:${props.draft.alias_id}` : props.draft.external_account_id || '')
const senderMissing = computed(() => Boolean(selectedSender.value) && senderLoaded.value && !externalSenders.value.some(row => row.alias_id ? selectedSender.value === `alias:${row.alias_id}` : selectedSender.value === row.external_account_id))

async function loadSenderChoices() {
  try {
    externalSenders.value = (await fetchMailSenders()).filter(row => Boolean(row.external_account_id || row.alias_id))
  } catch {
    externalSenders.value = []
  } finally {
    senderLoaded.value = true
  }
}

const scheduleMode = ref(Boolean(props.draft.send_at))
const scheduledLocal = ref(props.draft.send_at ? toLocalDateTime(props.draft.send_at) : '')

function toLocalDateTime(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function getSendAt(): string | undefined {
  if (!scheduleMode.value) return undefined
  const stamp = Date.parse(scheduledLocal.value)
  if (!Number.isFinite(stamp) || stamp <= Date.now() + 5000 || stamp > Date.now() + 90 * 86400000) {
    throw new Error('请选择 5 秒后至 90 天内的有效发送时间。')
  }
  return new Date(stamp).toISOString()
}

const toText = ref(props.draft.to.join(', '))
const ccText = ref(props.draft.cc.join(', '))
const bccText = ref(props.draft.bcc.join(', '))

const showCc = ref(Boolean(props.draft.cc.length))
const showBcc = ref(Boolean(props.draft.bcc.length))

watch(ccText, val => {
  if (val.trim()) showCc.value = true
})
watch(bccText, val => {
  if (val.trim()) showBcc.value = true
})

const subject = ref(props.draft.subject)
const text = ref(props.draft.text)
const html = ref(props.draft.html || '')
const attachments = ref([...props.draft.attachments])
const rich = ref(Boolean(html.value))
const editor = ref<HTMLElement | null>(null)

const draftId = ref(props.draft.id)
const conflicted = ref(false)
const ambiguousSend = ref(false)
const saving = ref(false)
const sending = ref(false)
const uploading = ref(false)
const error = ref('')
const confirmDiscard = ref(false)

const contentLocked = computed(() => sending.value || ambiguousSend.value)
const changedSnapshot = computed(() => JSON.stringify({
  to: toText.value,
  cc: ccText.value,
  bcc: bccText.value,
  subject: subject.value,
  text: text.value,
  html: html.value,
  attachments: attachments.value,
  sender: selectedSender.value,
  sendAt: scheduleMode.value ? scheduledLocal.value : null,
}))

const initiallyEmpty = !props.draft.subject && !props.draft.text && !props.draft.html && !props.draft.to.length && !props.draft.cc.length && !props.draft.bcc.length && !props.draft.attachments.length
const savedSnapshot = ref(props.draft.updated_at || initiallyEmpty ? changedSnapshot.value : '')
const revision = ref(props.draft.revision || 0)
const updatedAt = ref(props.draft.updated_at || '')
const dirty = computed(() => savedSnapshot.value !== changedSnapshot.value)

let saveTimer: ReturnType<typeof setTimeout> | undefined
let savePromise: Promise<void> | undefined
let disposed = false
let discarding = false
let submissionId = newRequestID()
let submissionSnapshot = ''

function looseRecipients(value: string) {
  return value.split(/[,;\n，；]+/).map(v => v.trim()).filter(Boolean)
}

function fields(strict = false): MailComposeFields {
  return {
    ...(selectedSender.value.startsWith('alias:') ? { alias_id: selectedSender.value.slice(6) } : selectedSender.value ? { external_account_id: selectedSender.value } : {}),
    to: strict ? parseRecipients(toText.value) : looseRecipients(toText.value),
    cc: strict ? parseRecipients(ccText.value) : looseRecipients(ccText.value),
    bcc: strict ? parseRecipients(bccText.value) : looseRecipients(bccText.value),
    subject: subject.value,
    text: text.value,
    html: rich.value ? html.value : undefined,
    attachments: [...attachments.value],
    send_at: scheduleMode.value && scheduledLocal.value ? new Date(scheduledLocal.value).toISOString() : undefined,
    in_reply_to: props.draft.in_reply_to,
    references: props.draft.references,
  }
}

async function persist() {
  if (discarding || disposed) return
  if (conflicted.value) throw new Error('草稿已在另一处更新，请另存为新草稿。')
  if (savePromise) {
    await savePromise
    if (dirty.value) await persist()
    return
  }
  if (!dirty.value) return
  const snapshot = changedSnapshot.value
  saving.value = true
  savePromise = (async () => {
    try {
      const saved = await saveMailDraft({ id: draftId.value, revision: revision.value, ...fields() })
      revision.value = saved.revision || revision.value + 1
      updatedAt.value = saved.updated_at || ''
      savedSnapshot.value = snapshot
      error.value = ''
      emit('saved')
    } catch (cause) {
      conflicted.value = cause instanceof ApiErrorResponseError && cause.status === 409
      error.value = conflicted.value
        ? '草稿已在另一处更新。当前内容已保留，请另存为新草稿后继续。'
        : '草稿保存失败，请保持页面打开后重试。'
      throw new Error(error.value)
    } finally {
      saving.value = false
    }
  })()
  try {
    await savePromise
  } finally {
    savePromise = undefined
  }
  if (dirty.value && !discarding && !disposed) await persist()
}

watch(changedSnapshot, () => {
  clearTimeout(saveTimer)
  if (submissionSnapshot && submissionSnapshot !== changedSnapshot.value) {
    submissionId = newRequestID()
    submissionSnapshot = ''
  }
  if (conflicted.value) return
  saveTimer = setTimeout(() => {
    void persist().catch(() => {})
  }, 900)
})

async function closeComposer() {
  if (sending.value || uploading.value) return
  clearTimeout(saveTimer)
  try {
    await persist()
    emit('close')
  } catch {
    /* Keep editor open for retry. */
  }
}

async function saveAsCopy() {
  draftId.value = newRequestID()
  revision.value = 0
  updatedAt.value = ''
  savedSnapshot.value = ''
  conflicted.value = false
  try {
    await persist()
  } catch {
    /* Retain current contents for retry. */
  }
}

async function discard() {
  discarding = true
  clearTimeout(saveTimer)
  if (savePromise) await savePromise.catch(() => {})
  try {
    if (revision.value) await deleteMailDraft(draftId.value)
    emit('saved')
    emit('close')
  } catch {
    discarding = false
    error.value = '无法删除草稿，请重试。'
  }
}

async function sendMessage() {
  if (sending.value || uploading.value || conflicted.value) return
  let queueAttempted = false
  try {
    if (senderMissing.value) throw new Error('原发件地址已停用或不可用，请重新选择发件人。')
    const sendAt = getSendAt()
    const content = fields(true)
    if (!content.to.length && !content.cc.length && !content.bcc.length) {
      throw new Error('请填写至少一个收件人、抄送或密送地址。')
    }
    if (content.to.length + content.cc.length + content.bcc.length > 50) {
      throw new Error('请将收件人总数控制在 50 人以内。')
    }
    if (!content.text.trim() && !content.attachments.length) {
      throw new Error('请填写邮件正文或添加附件。')
    }
    sending.value = true
    error.value = ''
    clearTimeout(saveTimer)
    await persist()
    submissionSnapshot = changedSnapshot.value
    const sendKey = `atoman.mail.send.${draftId.value}.${revision.value}`
    try {
      submissionId = localStorage.getItem(sendKey) || submissionId
      localStorage.setItem(sendKey, submissionId)
    } catch {
      /* In-memory retries still preserve this submission. */
    }
    queueAttempted = true
    ambiguousSend.value = true
    const queued = await queueMail(content, submissionId, draftId.value, revision.value, sendAt)
    ambiguousSend.value = false
    if (queued.status === 'cancelled' || queued.status === 'blocked') {
      try {
        localStorage.removeItem(sendKey)
      } catch {
        /* optional storage */
      }
      submissionId = newRequestID()
      error.value = queued.status === 'cancelled' ? '上次发送已撤销，请再次点击发送。' : '上次邮件未发出，请检查后再次发送。'
      return
    }
    emit('queued', queued, { id: draftId.value, revision: revision.value, updated_at: updatedAt.value, ...content })
    emit('close')
  } catch (cause) {
    if (queueAttempted && cause instanceof ApiErrorResponseError && [400, 401, 403, 413, 422, 429].includes(cause.status)) {
      ambiguousSend.value = false
      try {
        localStorage.removeItem(`atoman.mail.send.${draftId.value}.${revision.value}`)
      } catch {
        /* optional storage */
      }
      error.value = '邮件未提交，请检查收件人和附件后重试。'
    } else if (queueAttempted) {
      error.value = '发送结果尚未确认，内容已暂时锁定。请点击「确认发送状态」，或保存关闭后检查发送状态。'
    } else if (!error.value) {
      error.value = cause instanceof Error ? cause.message : '邮件尚未提交，请重试。'
    }
  } finally {
    sending.value = false
  }
}

// 拖拽附件上传与剪贴板文件上传逻辑
const isDraggingOver = ref(false)
let dragCounter = 0

function onDragEnter(e: DragEvent) {
  if (contentLocked.value || uploading.value) return
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter++
    isDraggingOver.value = true
  }
}

function onDragLeave(e: DragEvent) {
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) {
    isDraggingOver.value = false
  }
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

async function onDrop(e: DragEvent) {
  dragCounter = 0
  isDraggingOver.value = false
  if (contentLocked.value || uploading.value) return
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) {
    await processAttachmentFiles(files)
  }
}

async function processAttachmentFiles(files: File[]) {
  if (files.some(file => file.size > 10 * 1024 * 1024 || file.size === 0)) {
    error.value = '每个附件需大于 0 字节且不超过 10 MB。'
    return
  }
  if (attachments.value.length + files.length > 20 || [...attachments.value, ...files].reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) {
    error.value = '每封邮件最多添加 20 个附件，总大小不超过 25 MB。'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    for (const file of files) {
      attachments.value.push(await uploadMailAttachment(file))
    }
    await persist()
  } catch {
    error.value = '部分附件上传失败，请检查附件清单后重试。'
  } finally {
    uploading.value = false
  }
}

async function addAttachments(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length) {
    await processAttachmentFiles(files)
  }
}

function onEditorPaste(event: ClipboardEvent) {
  if (contentLocked.value || uploading.value) return
  const items = event.clipboardData?.items
  if (items && items.length) {
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length) {
      event.preventDefault()
      void processAttachmentFiles(files)
      return
    }
  }
  pastePlain(event)
}

function captureRich() {
  if (editor.value) {
    text.value = editor.value.innerText
    html.value = DOMPurify.sanitize(editor.value.innerHTML, {
      ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'code'],
      ALLOWED_ATTR: [],
    })
  }
}

const activeFormats = ref({
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertUnorderedList: false,
  insertOrderedList: false,
})

function updateActiveFormats() {
  if (!rich.value || !editor.value) return
  try {
    activeFormats.value = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    }
  } catch {
    /* ignore queryCommandState errors in edge states */
  }
}

function format(command: string) {
  editor.value?.focus()
  document.execCommand(command)
  captureRich()
  updateActiveFormats()
}

function pastePlain(event: ClipboardEvent) {
  event.preventDefault()
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
  captureRich()
}

async function setRich(enabled: boolean) {
  rich.value = enabled
  if (enabled) {
    await nextTick()
    if (editor.value) editor.value.innerText = text.value
    captureRich()
  } else {
    html.value = ''
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    void sendMessage()
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || uploading.value || sending.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onBeforeRouteLeave(async () => {
  if (sending.value || uploading.value) return false
  try {
    await persist()
    return true
  } catch {
    return false
  }
})

async function loadComposerEnhancements() {
  try {
    contacts.value = await fetchMailContacts()
  } catch {
    contacts.value = []
  }
  try {
    const prefs = await fetchMailPreferences()
    const sig = prefs.signature
    if (!sig?.enabled || revision.value !== 0 || text.value !== props.draft.text || subject.value !== props.draft.subject) return
    if (props.draft.in_reply_to && !sig.on_reply) return
    const lines = sig.text?.trim()
    if (!lines) return
    const block = '\n\n--\n' + lines + '\n'
    if (props.draft.in_reply_to && text.value.trim()) text.value = block + text.value
    else text.value = (text.value.trim() ? text.value.trim() : '') + block
    if (rich.value && sig.html) {
      const safe = DOMPurify.sanitize(sig.html, { ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'], ALLOWED_ATTR: [] })
      html.value = safe + html.value
      if (editor.value) editor.value.innerHTML = html.value
    }
  } catch {
    /* Signature lookup is optional; do not block composing. */
  }
}

onMounted(async () => {
  try {
    ambiguousSend.value = Boolean(localStorage.getItem(`atoman.mail.send.${draftId.value}.${revision.value}`))
    if (ambiguousSend.value) error.value = '这封草稿有待确认的发送记录，请先确认发送状态。'
  } catch {
    /* optional storage */
  }
  await nextTick()
  if (editor.value) {
    editor.value.innerHTML = DOMPurify.sanitize(html.value, { ALLOWED_TAGS: ['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'code'], ALLOWED_ATTR: [] })
  }
  window.addEventListener('beforeunload', beforeUnload)
  void loadComposerEnhancements()
  void loadSenderChoices()
})

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(saveTimer)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<style scoped>
.mail-compose {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  color: var(--a-color-fg);
}

.mail-compose.is-dragging {
  user-select: none;
}

.mail-compose__drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 2px dashed var(--a-color-primary);
  border-radius: var(--a-radius-card);
  backdrop-filter: blur(2px);
  color: var(--a-color-primary);
  pointer-events: none;
}
:root.dark .mail-compose__drop-overlay {
  background: rgba(24, 24, 27, 0.92);
}
.mail-compose__drop-overlay p {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.mail-compose__content {
  flex: 1;
  display: grid;
  gap: 18px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 48px) 36px;
}

.mail-compose__identity {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.mail-compose__sender-box {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--a-color-muted-soft);
  font-size: 13px;
  font-weight: 500;
}
.mail-compose__sender-box label {
  color: var(--a-color-muted);
  font-size: 13px;
  font-weight: 500;
}
.mail-compose__sender-box select {
  max-width: min(100%, 420px);
  min-height: 36px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  transition: border-color 140ms ease, background-color 140ms ease;
  cursor: pointer;
}
.mail-compose__sender-box select:hover:not(:disabled) {
  border-color: var(--a-color-border);
}
.mail-compose__sender-box select:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.mail-compose__recipient-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.mail-compose__recipient-field {
  flex: 1;
  min-width: 0;
}
.mail-compose__recipient-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 28px;
}
.mail-compose__pill-btn {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface);
  color: var(--a-color-muted);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 9px;
  cursor: pointer;
  transition: all 140ms ease;
}
.mail-compose__pill-btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}
.mail-compose__pill-btn.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-primary);
  border-color: var(--a-color-border);
}

.mail-compose__copies {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.mail-compose__copies.is-collapsed {
  display: none;
}
.mail-compose__copy-item {
  min-width: 0;
}

.mail-compose__format-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.mail-compose__format-tools {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
.mail-compose__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 120ms ease;
}
.mail-compose__tool-btn:hover:not(:disabled) {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}
.mail-compose__tool-btn.is-active {
  background: var(--a-color-surface);
  color: var(--a-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.mail-compose__tool-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--a-color-border-soft);
}

.mail-compose__editor-wrap {
  position: relative;
  min-height: 320px;
}
.mail-compose__editor {
  display: block;
  min-height: 320px;
  width: 100%;
  padding: 18px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 14px;
  line-height: 1.8;
  font-family: inherit;
  overflow-wrap: anywhere;
  transition: border-color 140ms ease;
}
.mail-compose__editor:empty::before {
  content: attr(data-placeholder);
  color: var(--a-color-muted-soft);
  pointer-events: none;
}
.mail-compose__editor:hover:not(:disabled) {
  border-color: var(--a-color-border);
}
.mail-compose__editor:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}
.mail-compose__body :deep(.p-textarea) {
  min-height: 320px;
  line-height: 1.8;
  resize: vertical;
}

.mail-compose__attachments-section {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
.mail-compose__attachments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-fg);
}
.mail-compose__attachments-head small {
  font-size: 12px;
  font-weight: 400;
  color: var(--a-color-muted);
}
.mail-compose__attachments-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mail-compose__attachment-card {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface);
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-fg);
}
.mail-compose__attachment-card.is-uploading {
  color: var(--a-color-muted);
}
.mail-compose__attachment-icon {
  color: var(--a-color-muted);
  flex-shrink: 0;
}
.mail-compose__attachment-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.mail-compose__attachment-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mail-compose__attachment-size {
  font-size: 11px;
  color: var(--a-color-muted);
  flex-shrink: 0;
}
.mail-compose__attachment-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 0;
  padding: 3px;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: var(--a-radius-control);
  transition: all 140ms ease;
}
.mail-compose__attachment-remove:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.mail-compose__schedule {
  display: grid;
  gap: 10px;
  align-items: start;
  padding: 14px 16px;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
.mail-compose__schedule label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.mail-compose__schedule input[type=checkbox] {
  width: 15px;
  height: 15px;
  accent-color: var(--a-color-primary);
  margin: 0;
}
.mail-compose__schedule p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 12px;
}

.mail-compose__error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 13px;
}

/* 底部吸底操作栏 */
.mail-compose__footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px clamp(16px, 4vw, 48px);
  background: var(--a-color-surface);
  border-top: 1px solid var(--a-color-border-soft);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.04);
}
.mail-compose__footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.mail-compose__footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.mail-compose__upload {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.mail-compose__upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.mail-compose__shortcut-tip {
  font-size: 12px;
  color: var(--a-color-muted);
}
.mail-compose__discard {
  color: var(--a-color-danger);
}
.mail-compose__discard:hover {
  background: var(--a-color-surface-muted);
}

@media (max-width: 680px) {
  .mail-compose__content {
    padding: 16px 14px 24px;
    gap: 14px;
  }
  .mail-compose__recipient-row {
    flex-direction: column;
    gap: 8px;
  }
  .mail-compose__recipient-actions {
    padding-top: 0;
  }
  .mail-compose__copies {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .mail-compose__format-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .mail-compose__editor,
  .mail-compose__body :deep(.p-textarea) {
    min-height: 220px;
  }
  .mail-compose__footer {
    padding: 12px 14px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .mail-compose__footer-left,
  .mail-compose__footer-right {
    justify-content: space-between;
    width: 100%;
  }
  .mail-compose__shortcut-tip {
    display: none;
  }
}
</style>
