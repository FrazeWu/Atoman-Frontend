<template>
  <div class="mail-page" data-testid="mail-workspace">
    <header class="mail-page__header">
      <div class="mail-page__identity">
        <span class="mail-page__wordmark">ATOMAN <span>MAIL</span></span>
        <h1>电子邮件</h1>
        <p v-if="mailAccount?.address" class="mail-page__address">{{ mailAccount.address }}</p>
        <p v-else class="mail-page__subtitle">一个账号，管理你的日常通信</p>
      </div>
      <div class="mail-page__actions">
        <span v-if="mailIsActive" class="mail-page__status"><span class="mail-page__status-dot" /> 已开通</span>
        <span v-else-if="mailAccount && !mailIsActive" class="mail-page__status">{{ statusLabel }}</span>
        <button type="button" class="mail-icon-button" aria-label="刷新邮箱" title="刷新" :disabled="loadingAccount || redeeming || (mailIsActive && foldersLoading)" @click="refreshMailbox">
          <RefreshCw :size="18" :class="{ 'mail-spin': loadingAccount || foldersLoading }" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="loadingAccount" class="mail-gate" role="status" aria-live="polite" data-testid="mail-loading">
      <div class="mail-gate__icon"><Mail :size="28" :stroke-width="1.5" /></div>
      <h2>正在加载邮箱状态</h2>
      <p>正在确认你的 Atoman 账号是否已开通电子邮件。</p>
    </div>

    <div v-else-if="accountError" class="mail-gate" role="alert" data-testid="mail-account-error">
      <div class="mail-gate__icon"><CircleAlert :size="28" :stroke-width="1.5" /></div>
      <h2>暂时无法连接邮箱</h2>
      <p>{{ accountError }}</p>
      <PButton variant="secondary" size="sm" @click="refreshMailbox">重新加载</PButton>
    </div>

    <section v-else-if="!mailIsActive" class="mail-gate" aria-labelledby="mail-unavailable-title" data-testid="mail-not-active">
      <div class="mail-gate__icon"><Mail :size="29" :stroke-width="1.5" /></div>
      <p class="mail-gate__eyebrow">ATOMAN MAIL</p>
      <h2 id="mail-unavailable-title">{{ statusTitle }}</h2>
      <p>{{ statusDescription }}</p>
      <div v-if="mailAccount?.address" class="mail-gate__reserved">
        <span>预留地址</span>
        <strong>{{ mailAccount.address }}</strong>
        <small>当前不可收发邮件</small>
      </div>
      <form v-else-if="mailAccount?.status === 'not_invited' && isMailAdministrator" class="mail-gate__redeem" data-testid="mail-admin-self-form" @submit.prevent="reserveSelf">
        <label for="mail-self-local">为自己选择邮箱名称</label>
        <div class="mail-gate__address-fields">
          <input id="mail-self-local" v-model.trim="chosenLocalPart" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32" placeholder="例如 fazong.wu" aria-label="我的邮箱名称" :disabled="redeeming" />
          <span>@atoman.org</span>
        </div>
        <PButton size="sm" type="submit" :disabled="!isChosenLocalValid || redeeming" :loading="redeeming">预留我的邮箱地址</PButton>
        <p v-if="redeemError" class="mail-gate__form-error" role="alert">{{ redeemError }}</p>
        <small>管理员无需邀请码。创建后会绑定到你的 Atoman 账号，不会随网站用户名变化；正式收发仍需等待服务开放。</small>
      </form>
      <form v-else-if="mailAccount?.status === 'not_invited'" class="mail-gate__redeem" data-testid="mail-invite-redeem-form" @submit.prevent="redeemInvite">
        <label for="mail-invitation">邮箱邀请码</label>
        <input id="mail-invitation" v-model.trim="invitation" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100" placeholder="输入收到的邀请码" :disabled="redeeming" />
        <label for="mail-chosen-local">自行选择邮箱名称</label>
        <div class="mail-gate__address-fields">
          <input id="mail-chosen-local" v-model.trim="chosenLocalPart" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32" placeholder="例如 your.name" aria-label="邮箱名称" :disabled="redeeming" />
          <span>@atoman.org</span>
        </div>
        <PButton size="sm" type="submit" :disabled="invitation.length !== 43 || !isChosenLocalValid || redeeming" :loading="redeeming">领取邮箱地址</PButton>
        <p v-if="redeemError" class="mail-gate__form-error" role="alert">{{ redeemError }}</p>
        <small>邮箱名与你的登录账号绑定，但由你自行填写，不必与用户名相同。领取仅预留地址，不能立即收发邮件。</small>
      </form>
      <p class="mail-gate__footnote"><ShieldCheck :size="15" aria-hidden="true" /> 与 Atoman 现有账号绑定，无需单独注册</p>
    </section>

    <section v-else class="mail-workspace" aria-label="Atoman 邮箱" data-testid="mail-active-workspace">
      <aside class="mail-workspace__folders" :class="{ 'mail-mobile-visible': mobilePane === 'folders' }" aria-label="邮箱文件夹" data-testid="mail-folder-pane">
        <div class="mail-workspace__folders-header">
          <span class="mail-workspace__section-label">邮箱</span>
          <button type="button" class="mail-workspace__new" disabled title="写邮件功能尚未开放"><Pencil :size="16" aria-hidden="true" /> 写邮件</button>
        </div>
        <div class="mail-workspace__folder-title">文件夹</div>
        <div v-if="foldersLoading" class="mail-workspace__subtle" role="status">正在获取文件夹…</div>
        <div v-else-if="foldersError" class="mail-workspace__inline-error" role="alert">
          {{ foldersError }}
          <button type="button" @click="loadFolders">重试</button>
        </div>
        <nav v-else class="mail-workspace__folder-list" aria-label="邮件文件夹列表">
          <button
            v-for="folder in folders"
            :key="folder.id"
            type="button"
            class="mail-workspace__folder"
            :class="{ 'is-active': currentFolderId === folder.id }"
            :aria-current="currentFolderId === folder.id ? 'page' : undefined"
            @click="selectFolder(folder.id)"
          >
            <component :is="folderIcon(folder.role)" :size="17" :stroke-width="1.8" aria-hidden="true" />
            <span class="mail-workspace__folder-name">{{ folderLabel(folder) }}</span>
            <span v-if="folder.unreadEmails > 0" class="mail-workspace__folder-count">{{ folder.unreadEmails > 999 ? '999+' : folder.unreadEmails }}</span>
          </button>
          <p v-if="folders.length === 0" class="mail-workspace__subtle">尚未建立邮件文件夹</p>
        </nav>
        <div class="mail-workspace__sidebar-foot">Atoman Mail · 预览版本</div>
      </aside>

      <section class="mail-workspace__list" :class="{ 'mail-mobile-visible': mobilePane === 'list' }" aria-label="邮件列表" data-testid="mail-list-pane">
        <div class="mail-workspace__list-header">
          <button type="button" class="mail-workspace__mobile-back mail-icon-button" aria-label="返回文件夹" @click="mobilePane = 'folders'"><ChevronLeft :size="21" /></button>
          <div class="mail-workspace__heading">
            <h2>{{ currentFolder ? folderLabel(currentFolder) : '邮件' }}</h2>
            <small v-if="currentFolder">{{ currentFolder.totalEmails }} 封邮件</small>
          </div>
          <button type="button" class="mail-icon-button" aria-label="刷新邮件列表" :disabled="!currentFolderId || loadingMessages" @click="reloadMessages"><RefreshCw :size="18" :class="{ 'mail-spin': loadingMessages }" /></button>
        </div>
        <label class="mail-workspace__search">
          <Search :size="17" aria-hidden="true" />
          <input v-model="localSearch" type="search" aria-label="筛选已加载的邮件" placeholder="筛选当前列表" :disabled="!currentFolderId || loadingMessages" />
        </label>
        <p class="mail-workspace__search-note">仅筛选当前加载的前 50 封邮件</p>
        <div class="mail-workspace__message-scroll" :aria-busy="loadingMessages" role="region" aria-label="邮件条目">
          <div v-if="loadingMessages" class="mail-workspace__list-state" role="status">正在加载邮件…</div>
          <div v-else-if="messagesError" class="mail-workspace__list-state" role="alert">
            <p>{{ messagesError }}</p>
            <PButton size="sm" variant="secondary" @click="reloadMessages">重试</PButton>
          </div>
          <div v-else-if="!currentFolderId" class="mail-workspace__list-state">请先选择一个文件夹</div>
          <div v-else-if="visibleMessages.length === 0" class="mail-workspace__list-state">
            <MailOpen :size="24" :stroke-width="1.5" aria-hidden="true" />
            {{ localSearch ? '当前列表没有匹配的邮件' : '这里还没有邮件' }}
          </div>
          <button
            v-for="message in !loadingMessages && !messagesError ? visibleMessages : []"
            :key="message.id"
            type="button"
            class="mail-workspace__message"
            :class="{ 'is-selected': selectedMessageId === message.id }"
            :aria-pressed="selectedMessageId === message.id"
            :data-testid="`mail-message-${message.id}`"
            @click="openMessage(message.id)"
          >
            <span class="mail-workspace__message-first">
              <span class="mail-workspace__message-subject">{{ message.subject || '（无主题）' }}</span>
              <small>{{ messageTime(message.receivedAt) }}</small>
            </span>
            <span class="mail-workspace__message-preview">{{ message.preview || '暂无预览内容' }}</span>
            <span v-if="message.hasAttachment" class="mail-workspace__attachment"><Paperclip :size="13" aria-hidden="true" /> 含附件</span>
          </button>
        </div>
      </section>

      <section class="mail-workspace__reader" :class="{ 'mail-mobile-visible': mobilePane === 'reader' }" aria-label="邮件预览" data-testid="mail-reader-pane">
        <template v-if="selectedMessage">
          <div class="mail-workspace__reader-head">
            <button type="button" class="mail-icon-button mail-workspace__mobile-back" aria-label="返回邮件列表" @click="mobilePane = 'list'"><ChevronLeft :size="21" /></button>
            <span>邮件预览</span>
            <span class="mail-workspace__read-tag">只读</span>
          </div>
          <article class="mail-workspace__reader-body" data-testid="mail-selected-preview">
            <h2>{{ selectedMessage.subject || '（无主题）' }}</h2>
            <div class="mail-workspace__meta">
              <div><span>接收时间</span><strong>{{ fullMessageTime(selectedMessage.receivedAt) }}</strong></div>
              <div><span>会话</span><strong>{{ selectedMessage.threadId ? '已归入会话' : '单封邮件' }}</strong></div>
              <div v-if="selectedMessage.hasAttachment"><span>附件</span><strong>包含附件</strong></div>
            </div>
            <div class="mail-workspace__body-preview">
              <p class="mail-workspace__body-label">内容摘要</p>
              <p>{{ selectedMessage.preview || '暂无内容摘要' }}</p>
            </div>
            <p class="mail-workspace__reader-note"><Info :size="16" aria-hidden="true" /> 这里仅显示服务器提供的邮件列表摘要。完整正文、附件下载、回复和转发尚未开放。</p>
          </article>
        </template>
        <div v-else class="mail-workspace__reader-empty">
          <MailOpen :size="32" :stroke-width="1.4" aria-hidden="true" />
          <h2>选择一封邮件</h2>
          <p>从左侧邮件列表中选择，即可查看现有摘要信息。</p>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Archive, ChevronLeft, CircleAlert, File, FileText, Inbox, Info, Mail, MailOpen, Paperclip, Pencil, RefreshCw, Search, Send, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import { ApiErrorResponseError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { fetchMailFolders, fetchMailSummaries, fetchMyMailAccount, redeemMailInvitation, reserveAdminMailAddress, type MailAccountInfo, type MailFolder, type MailSummary } from '@/api/mail'

type MobilePane = 'folders' | 'list' | 'reader'
const authStore = useAuthStore()
const isMailAdministrator = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'owner')
const mobilePane = ref<MobilePane>('list')
const mailAccount = ref<MailAccountInfo | null>(null)
const loadingAccount = ref(true)
const accountError = ref('')
const folders = ref<MailFolder[]>([])
const foldersLoading = ref(false)
const foldersError = ref('')
const currentFolderId = ref('')
const messages = ref<MailSummary[]>([])
const loadingMessages = ref(false)
const messagesError = ref('')
const selectedMessageId = ref('')
const localSearch = ref('')
const invitation = ref('')
const chosenLocalPart = ref('')
const isChosenLocalValid = computed(() => {
  const local = chosenLocalPart.value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(local) && !local.includes('..')
})
const redeeming = ref(false)
const redeemError = ref('')
let accountGeneration = 0
let folderGeneration = 0
let messageGeneration = 0
let disposed = false

const mailIsActive = computed(() => mailAccount.value?.status === 'active' && mailAccount.value.available === true)
const statusLabel = computed(() => {
  switch (mailAccount.value?.status) {
    case 'reserved': return '地址已预留'
    case 'provisioning': return '正在准备邮箱'
    case 'suspended': return '邮箱已暂停'
    case 'failed': return '开通未完成'
    default: return '未开通'
  }
})
const statusTitle = computed(() => {
  switch (mailAccount.value?.status) {
    case 'reserved': return '邮箱地址已预留'
    case 'provisioning': return '邮箱正在准备中'
    case 'suspended': return '邮箱服务已暂停'
    case 'failed': return '邮箱尚未完成开通'
    case 'not_invited': return isMailAdministrator.value ? '设置你的专属邮箱地址' : '邮箱暂未向你的账号开放'
    default: return '邮箱服务尚未开放'
  }
})
const statusDescription = computed(() => {
  switch (mailAccount.value?.status) {
    case 'reserved': return '你的专属地址已保存。邮件基础设施准备就绪后才能开始收发邮件。'
    case 'provisioning': return '账户开通需要完成服务检查。在此期间还不能使用邮箱。'
    case 'suspended': return '当前地址的邮件访问已暂停。如需协助，请联系管理员。'
    case 'failed': return '邮箱开通过程尚未完成，请联系管理员核查。'
    case 'not_invited': return isMailAdministrator.value ? '管理员可以直接选择邮箱名称，无需等待邀请码。' : 'Atoman 邮箱采用邀请制。收到邀请码后，可以自主选择邮箱名称。'
    default: return '邮件服务仍在配置中。当前不能发送、接收或查看邮件。'
  }
})

const currentFolder = computed(() => folders.value.find(item => item.id === currentFolderId.value) || null)
const selectedMessage = computed(() => messages.value.find(item => item.id === selectedMessageId.value) || null)
const visibleMessages = computed(() => {
  const term = localSearch.value.trim().toLocaleLowerCase()
  return term ? messages.value.filter(message => `${message.subject} ${message.preview}`.toLocaleLowerCase().includes(term)) : messages.value
})

function folderIcon(role: string | null) {
  switch (role) {
    case 'inbox': return Inbox
    case 'sent': return Send
    case 'drafts': return FileText
    case 'trash': return Trash2
    case 'junk': return ShieldAlert
    case 'archive': return Archive
    default: return File
  }
}
function folderLabel(folder: MailFolder) {
  switch (folder.role) {
    case 'inbox': return '收件箱'
    case 'sent': return '已发送'
    case 'drafts': return '草稿箱'
    case 'trash': return '已删除'
    case 'junk': return '垃圾邮件'
    case 'archive': return '归档'
    default: return folder.name
  }
}
function formatMessageTime(value: string, full = false) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', full ? { dateStyle: 'medium', timeStyle: 'short' } : { month: '2-digit', day: '2-digit' }).format(parsed)
}
const messageTime = (value: string) => formatMessageTime(value)
const fullMessageTime = (value: string) => formatMessageTime(value, true)

function messageForError(error: unknown, fallback: string) {
  if (error instanceof ApiErrorResponseError) {
    if (error.status === 404 || error.status === 503) return '邮箱功能尚未就绪，请稍后重试。'
    if (error.status === 401) return '登录状态已失效，请重新登录后访问邮箱。'
    if (error.status === 403) return '当前账号没有此邮箱的访问权限。'
  }
  return fallback
}

async function loadMessages(folderId: string) {
  const generation = ++messageGeneration
  messages.value = []
  selectedMessageId.value = ''
  localSearch.value = ''
  messagesError.value = ''
  if (!folderId || !mailIsActive.value) { loadingMessages.value = false; return }
  loadingMessages.value = true
  try {
    const result = await fetchMailSummaries(folderId, 50)
    if (disposed || generation !== messageGeneration || currentFolderId.value !== folderId) return
    messages.value = Array.isArray(result) ? result : []
  } catch (error) {
    if (disposed || generation !== messageGeneration || currentFolderId.value !== folderId) return
    messagesError.value = messageForError(error, '无法加载邮件列表，请重试。')
  } finally {
    if (!disposed && generation === messageGeneration) loadingMessages.value = false
  }
}

async function loadFolders() {
  const generation = ++folderGeneration
  ++messageGeneration
  foldersLoading.value = true
  foldersError.value = ''
  folders.value = []
  currentFolderId.value = ''
  messages.value = []
  selectedMessageId.value = ''
  localSearch.value = ''
  loadingMessages.value = false
  if (!mailIsActive.value) { foldersLoading.value = false; return }
  try {
    const result = await fetchMailFolders()
    if (disposed || generation !== folderGeneration || !mailIsActive.value) return
    folders.value = Array.isArray(result) ? result : []
    const preferred = folders.value.find(folder => folder.role === 'inbox') || folders.value[0]
    if (preferred) {
      currentFolderId.value = preferred.id
      // 文件夹列表应立即可交互，不必等待首个邮件请求完成。
      void loadMessages(preferred.id)
    }
  } catch (error) {
    if (disposed || generation !== folderGeneration) return
    foldersError.value = messageForError(error, '无法读取文件夹，请重试。')
  } finally {
    if (!disposed && generation === folderGeneration) foldersLoading.value = false
  }
}

async function refreshMailbox() {
  const generation = ++accountGeneration
  ++folderGeneration
  ++messageGeneration
  loadingAccount.value = true
  accountError.value = ''
  folders.value = []
  currentFolderId.value = ''
  messages.value = []
  selectedMessageId.value = ''
  try {
    const next = await fetchMyMailAccount()
    if (disposed || generation !== accountGeneration) return
    mailAccount.value = next
    if (mailIsActive.value) await loadFolders()
  } catch (error) {
    if (disposed || generation !== accountGeneration) return
    mailAccount.value = null
    accountError.value = messageForError(error, '无法确认邮箱状态，请检查网络后重试。')
  } finally {
    if (!disposed && generation === accountGeneration) loadingAccount.value = false
  }
}

function selectFolder(folderId: string) {
  if (!folders.value.some(folder => folder.id === folderId)) return
  if (currentFolderId.value !== folderId) {
    currentFolderId.value = folderId
    void loadMessages(folderId)
  }
  mobilePane.value = 'list'
}
function reloadMessages() { if (currentFolderId.value) void loadMessages(currentFolderId.value) }
function openMessage(messageId: string) {
  if (!messages.value.some(message => message.id === messageId)) return
  selectedMessageId.value = messageId
  mobilePane.value = 'reader'
}

async function redeemInvite() {
  const token = invitation.value.trim()
  if (redeeming.value || token.length !== 43 || !isChosenLocalValid.value || mailAccount.value?.status !== 'not_invited') return
  redeeming.value = true
  redeemError.value = ''
  try {
    const result = await redeemMailInvitation(token, chosenLocalPart.value.trim().toLowerCase())
    if (disposed) return
    mailAccount.value = result
    invitation.value = ''
    chosenLocalPart.value = ''
  } catch (error) {
    if (!disposed) redeemError.value = messageForError(error, '邀请码无效或已失效，请检查后重试。')
  } finally {
    if (!disposed) redeeming.value = false
  }
}

async function reserveSelf() {
  if (redeeming.value || !isMailAdministrator.value || !isChosenLocalValid.value || mailAccount.value?.status !== 'not_invited') return
  redeeming.value = true
  redeemError.value = ''
  try {
    const result = await reserveAdminMailAddress(chosenLocalPart.value.trim().toLowerCase())
    if (disposed) return
    mailAccount.value = result
    chosenLocalPart.value = ''
  } catch {
    if (!disposed) redeemError.value = '地址可能已被使用或不可预留。请换一个名称后再试。'
  } finally {
    if (!disposed) redeeming.value = false
  }
}

onMounted(() => { void refreshMailbox() })
onBeforeUnmount(() => {
  disposed = true
  ++accountGeneration
  ++folderGeneration
  ++messageGeneration
  messages.value = []
})
</script>

<style scoped src="./mail-workspace.css"></style>
