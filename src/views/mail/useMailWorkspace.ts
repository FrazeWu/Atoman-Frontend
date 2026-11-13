import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { fetchMailFolders, fetchMailDetail, markMailRead, fetchMyMailAccount, redeemMailInvitation, reserveAdminMailAddress, type MailAccountInfo, type MailFolder, type MailSummary, type MailDetail, type MailAttachmentInfo } from '@/api/mail'
import { queryMailMessages, fetchMailThread, fetchMailDrafts, fetchMailDraft, provisionMailAccount, reconcileMailOutbox, fetchMailOutbox, fetchMailOutboxes, cancelMailOutbox, mutateMailMessages, undoMailAction, createMailFolder, deleteMailFolder, downloadMailAttachment, downloadMailSource, fetchMailAttachmentBlob, uploadMailAttachment, fetchMailPreferences, saveMailPreferences, type MailDraft, type MailOutbox, type MailAction } from '@/api/mailClient'
import type { MailAdvancedFilters } from '@/api/mailClient'
import { addressText, groupConversations, mailTime, newRequestID, replyRecipients, type MailConversation } from './mail-helpers'

export function useMailWorkspace() {
  const authStore = useAuthStore()
  const isMailAdministrator = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'owner')
  const mailAccount = ref<MailAccountInfo | null>(null)
  const loadingAccount = ref(true), accountError = ref('')
  const mailIsActive = computed(() => mailAccount.value?.status === 'active' && mailAccount.value.available)
  const mobilePane = ref<'folders' | 'list' | 'reader'>('list')
  const folders = ref<MailFolder[]>([]), foldersLoading = ref(false), foldersError = ref(''), currentFolderId = ref('')
  const currentFolder = computed(() => folders.value.find(row => row.id === currentFolderId.value))
  const isDraftFolder = computed(() => currentFolder.value?.role === 'drafts')
  const messages = ref<MailSummary[]>([]), drafts = ref<MailDraft[]>([]), loadingMessages = ref(false), messagesError = ref('')
  const advancedOpen=ref(false), advancedFilters=ref<MailAdvancedFilters>({}), allFolders=ref(false)
  const searchText = ref(''), committedSearch = ref(''), position = ref(0), hasMore = ref(false), totalMessages = ref(0)
  const conversationMode = ref(true), selection = ref(new Set<string>()), selectedGroupId = ref('')
  const conversations = computed(() => groupConversations(messages.value, conversationMode.value))
  const allSelected = computed(() => messages.value.length > 0 && messages.value.every(row => selection.value.has(row.id)))
  const readerMessages = ref<MailSummary[]>([]), threadError = ref(''), expanded = ref(new Set<string>())
  const details = ref<Record<string, MailDetail>>({}), detailErrors = ref<Record<string, string>>({}), detailLoading = ref(new Set<string>()), htmlShown = ref<Record<string, boolean>>({})
  const composeDraft = ref<MailDraft | null>(null), composeWarning = ref(''), settingsOpen = ref(false), notice = ref(''), actionUndo = ref(''), actionBusy = ref(false)
  const pendingSends = ref<MailOutbox[]>([]), cancelBusy = ref(''), now = ref(Date.now())
  const sendDrafts = new Map<string, MailDraft>()
  const invitation = ref(''), chosenLocalPart = ref(''), redeeming = ref(false), redeemError = ref('')
  const isChosenLocalValid = computed(() => /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(chosenLocalPart.value.trim().toLowerCase()) && !chosenLocalPart.value.includes('..'))
  const folderDialog = ref(false), deleteFolderDialog = ref(false), newFolderName = ref(''), folderError = ref(''), folderWorking = ref(false)
  let disposed = false, accountGeneration = 0, folderGeneration = 0, messageGeneration = 0, readerGeneration = 0, queueRefreshing = false, lastQueueRefresh = 0
  let refreshTimer: ReturnType<typeof setInterval> | undefined, clockTimer: ReturnType<typeof setInterval> | undefined
  const readPending = new Set<string>()
  const statusLabel = computed(() => (({ reserved: '地址已预留', provisioning: '正在开通', suspended: '邮箱已暂停', failed: '开通未完成' } as Record<string, string>)[mailAccount.value?.status || ''] || '开通邮箱'))
  const statusTitle = computed(() => (({ reserved: '邮箱地址已预留', provisioning: '邮箱正在准备中', suspended: '邮箱服务已暂停', failed: '邮箱尚未完成开通', not_invited: isMailAdministrator.value ? '设置你的专属邮箱地址' : '用邀请开启你的邮箱' } as Record<string, string>)[mailAccount.value?.status || ''] || '邮箱暂时不可用'))
  const statusDescription = computed(() => (({ reserved: '你的专属地址已经保存，准备完成后即可使用。', provisioning: '请稍候，完成后便可收发邮件。', suspended: '如需恢复访问，请联系管理员。', failed: '请联系管理员协助完成开通。', not_invited: isMailAdministrator.value ? '选择一个邮箱名称，开始收发邮件。' : '输入邀请码，选择属于你的邮箱名称。' } as Record<string, string>)[mailAccount.value?.status || ''] || '请稍后重新检查。'))
  const folderLabel = (folder: MailFolder) => ({ inbox: '收件箱', sent: '已发送', drafts: '草稿', trash: '回收站', junk: '垃圾邮件', archive: '归档' }[folder.role || ''] || folder.name)
  function messageError(error: unknown, fallback: string) {
    if (error instanceof ApiErrorResponseError) {
      if (error.status === 401) return '登录已过期，请重新登录后继续。'
      if (error.status === 403) return '暂时无法访问这项邮件服务。'
      if (error.status === 409) return '邮件状态已更新，请刷新后重试。'
    }
    return fallback
  }
  function resetReaderState() {
    readerGeneration++
    expanded.value = new Set()
    details.value = {}
    detailErrors.value = {}
    detailLoading.value = new Set()
    htmlShown.value = {}
    threadError.value = ''
  }
  function clearReader() {
    resetReaderState()
    selectedGroupId.value = ''
    readerMessages.value = []
  }
  async function loadFolders(preserve = false) {
    const generation = ++folderGeneration
    foldersLoading.value = true; foldersError.value = ''
    try {
      const result = await fetchMailFolders()
      if (disposed || generation !== folderGeneration) return
      folders.value = result
      if (!preserve || !result.some(row => row.id === currentFolderId.value)) currentFolderId.value = (result.find(row => row.role === 'inbox') || result[0])?.id || ''
    } catch (error) { if (!disposed && generation === folderGeneration) foldersError.value = messageError(error, '文件夹暂时无法加载，请刷新重试。') }
    finally { if (generation === folderGeneration) foldersLoading.value = false }
  }
  async function loadMessages(more = false, preserve = false) {
    const folderId = currentFolderId.value
    if (!mailIsActive.value || !folderId) return
    const generation = ++messageGeneration
    loadingMessages.value = true; messagesError.value = ''
    if (!more && !preserve) { clearReader(); selection.value = new Set(); messages.value = []; drafts.value = [] }
    try {
      if (isDraftFolder.value) {
        const result = await fetchMailDrafts()
        if (disposed || generation !== messageGeneration || folderId !== currentFolderId.value) return
        drafts.value = result; messages.value = []; hasMore.value = false
      } else {
        const start = more ? position.value : 0
        const result = await queryMailMessages(allFolders.value ? '' : folderId, committedSearch.value, start, 50, advancedFilters.value)
        if (disposed || generation !== messageGeneration || folderId !== currentFolderId.value) return
        messages.value = more ? [...messages.value, ...result.items.filter(row => !messages.value.some(old => old.id === row.id))] : result.items
        drafts.value = []; hasMore.value = result.has_more; position.value = result.next_position ?? start + result.items.length; totalMessages.value = result.total ?? messages.value.length
        const visible = new Set(messages.value.map(row => row.id)); selection.value = new Set([...selection.value].filter(id => visible.has(id)))
      }
    } catch (error) { if (!disposed && generation === messageGeneration) messagesError.value = messageError(error, '邮件暂时无法加载，请重试。') }
    finally { if (generation === messageGeneration) loadingMessages.value = false }
  }
  async function refreshMailbox() {
    const generation = ++accountGeneration; loadingAccount.value = true; accountError.value = ''
    try {
      const result = await fetchMyMailAccount()
      if (disposed || generation !== accountGeneration) return
      mailAccount.value = result
      if (mailIsActive.value) { await loadFolders(true); await loadMessages(false, true); await refreshQueue() }
      else clearReader()
    } catch (error) { if (!disposed && generation === accountGeneration) accountError.value = messageError(error, '暂时无法连接邮箱，请稍后重试。') }
    finally { if (generation === accountGeneration) loadingAccount.value = false }
  }
  function selectFolder(id: string) { advancedFilters.value = {}; allFolders.value = false; currentFolderId.value = id; searchText.value = ''; committedSearch.value = ''; mobilePane.value = 'list'; return loadMessages() }
  function runSearch() { committedSearch.value = searchText.value.trim(); void loadMessages() }
  function setAdvancedSearch(filters:MailAdvancedFilters, all:boolean) {
    advancedFilters.value=filters;allFolders.value=all;advancedOpen.value=false
    void loadMessages()
  }
  function clearAdvancedSearch() {advancedFilters.value={};allFolders.value=false;void loadMessages()}

  function selectAll() { selection.value = allSelected.value ? new Set() : new Set(messages.value.slice(0, 100).map(row => row.id)) }
  function toggleGroup(group: MailConversation) { const next = new Set(selection.value); const remove = group.messages.every(row => next.has(row.id)); for (const row of group.messages) { if (remove) next.delete(row.id); else if (next.size < 100) next.add(row.id) }; selection.value = next }
  async function openConversation(group: MailConversation) {
    resetReaderState()
    selectedGroupId.value = group.id
    mobilePane.value = 'reader'
    readerMessages.value = [...group.messages].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    expanded.value = new Set([group.latest.id])
    void loadDetail(group.latest)
    if (!conversationMode.value || !group.latest.threadId) return
    const generation = readerGeneration, folderId = currentFolderId.value
    try {
      const thread = await fetchMailThread(folderId, group.latest.threadId)
      if (disposed || generation !== readerGeneration || selectedGroupId.value !== group.id) return
      if (thread.length) readerMessages.value = thread.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    } catch (error) { if (!disposed && generation === readerGeneration) threadError.value = messageError(error, '完整会话暂时无法加载，当前邮件仍可阅读。') }
  }
  function toggleExpanded(message: MailSummary) {
    const next = new Set(expanded.value)
    if (next.has(message.id)) next.delete(message.id)
    else { next.add(message.id); void loadDetail(message) }
    expanded.value = next
  }
  function detailFolder(message: MailSummary) { return message.mailboxIds?.includes(currentFolderId.value) ? currentFolderId.value : message.mailboxIds?.[0] || currentFolderId.value }
  async function markDisplayedRead(message: MailSummary, generation: number) {
    const id = message.id
    if (disposed || generation !== readerGeneration || !expanded.value.has(id) || mobilePane.value !== 'reader' || document.visibilityState === 'hidden' || details.value[id]?.isRead || readPending.has(id)) return
    readPending.add(id)
    try {
      await markMailRead(detailFolder(message), id)
      if (disposed || generation !== readerGeneration) return
      if (details.value[id]) details.value[id]!.isRead = true
      messages.value = messages.value.map(row => row.id === id ? { ...row, isRead: true } : row)
      readerMessages.value = readerMessages.value.map(row => row.id === id ? { ...row, isRead: true } : row)
      void loadFolders(true)
    } catch { if (!disposed && generation === readerGeneration) notice.value = '邮件已打开，但已读状态尚未保存。' }
    finally { readPending.delete(id) }
  }
  async function loadDetail(message: MailSummary) {
    const id = message.id, generation = readerGeneration
    if (detailLoading.value.has(id)) return
    if (details.value[id]) { await nextTick(); await markDisplayedRead(message, generation); return }
    detailLoading.value = new Set([...detailLoading.value, id]); detailErrors.value[id] = ''
    try {
      const result = await fetchMailDetail(detailFolder(message), id)
      if (disposed || generation !== readerGeneration || !readerMessages.value.some(row => row.id === id)) return
      details.value[id] = result
      detailLoading.value.delete(id); detailLoading.value = new Set(detailLoading.value)
      await nextTick(); await markDisplayedRead(message, generation)
    } catch (error) { if (!disposed && generation === readerGeneration) detailErrors.value[id] = messageError(error, '邮件正文暂时无法打开，请重试。') }
    finally { if (generation === readerGeneration) { detailLoading.value.delete(id); detailLoading.value = new Set(detailLoading.value) } }
  }
  function emptyDraft(): MailDraft { return { id: newRequestID(), to: [], cc: [], bcc: [], subject: '', text: '', attachments: [] } }
  function newMessage() { composeWarning.value = ''; composeDraft.value = emptyDraft() }
  async function editDraft(draft: MailDraft) {
    composeWarning.value = ''
    try { composeDraft.value = await fetchMailDraft(draft.id) }
    catch (error) { notice.value = messageError(error, '草稿暂时无法打开，请重试。') }
  }
  function replyTo(detail: MailDetail, all: boolean) {
    composeWarning.value = ''
    const recipients = replyRecipients(detail, mailAccount.value?.address || '', all)
    composeDraft.value = { ...emptyDraft(), ...recipients, subject: /^re:/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`, text: `\n\n在 ${mailTime(detail.receivedAt, true)}，${addressText(detail.from)} 写道：\n${detail.plainText.split('\n').map(line => `> ${line}`).join('\n')}`, in_reply_to: detail.messageId?.[0], references: detail.messageId || [] }
  }
  async function forwardMessage(detail: MailDetail) {
    if (actionBusy.value) return
    actionBusy.value = true; notice.value = detail.attachments.length ? '正在准备转发附件…' : ''
    const draft = { ...emptyDraft(), subject: /^fwd?:/i.test(detail.subject) ? detail.subject : `Fwd: ${detail.subject}`, text: `\n\n---------- 转发的邮件 ----------\n发件人：${addressText(detail.from)}\n时间：${mailTime(detail.receivedAt, true)}\n主题：${detail.subject}\n收件人：${addressText(detail.to)}\n\n${detail.plainText}` }
    const failed: string[] = []
    for (const attachment of detail.attachments) {
      try {
        if (!attachment.partId || attachment.size > 10 * 1024 * 1024 || draft.attachments.length >= 20) throw new Error('attachment limit')
        const blob = await fetchMailAttachmentBlob(detail.id, attachment.partId)
        if (draft.attachments.reduce((sum, item) => sum + item.size, 0) + blob.size > 25 * 1024 * 1024) throw new Error('attachment limit')
        draft.attachments.push(await uploadMailAttachment(new File([blob], attachment.name || 'attachment', { type: blob.type || 'application/octet-stream' })))
      } catch { failed.push(attachment.name || '附件') }
      if (disposed) break
    }
    actionBusy.value = false
    if (disposed) return
    composeDraft.value = draft
    composeWarning.value = failed.length ? `以下附件未加入转发，请检查后再发送：${failed.join('、')}` : ''
    notice.value = ''
  }
  async function downloadSource(detail: MailDetail) { try { await downloadMailSource(detail.id) } catch (error) { notice.value = messageError(error, '原始邮件暂时无法下载，请重试。') } }
  function onDraftSaved() { if (isDraftFolder.value) void loadMessages(false, true); void loadFolders(true) }
  function onQueued(outbox: MailOutbox, draft: MailDraft) { sendDrafts.set(outbox.id, draft); pendingSends.value = [outbox, ...pendingSends.value.filter(row => row.id !== outbox.id)]; now.value = Date.now() }
  function remainingSeconds(item: MailOutbox) { return Math.max(0, Math.ceil((new Date(item.send_after).getTime() - now.value) / 1000)) }
  function queueLabel(item: MailOutbox) {
    const labels: Record<string, string> = { queued: item.scheduled ? '已安排在 '+new Date(item.send_after).toLocaleString()+' 定时发送，可在发送前取消。' : remainingSeconds(item) ? '邮件准备发送，可撤销。' : '等待提交发送…', dispatching: '正在提交邮件…', sending: '正在提交邮件…', sent: '邮件已提交发送。', submitted: '邮件已提交发送。', cancelled: '发送已撤销，草稿已保留。', blocked: '邮件尚未发出，请检查草稿后重试。', failed: '发送未成功，请打开草稿检查。', uncertain: '发送结果正在确认，请勿重复发送。' }
    return labels[item.status] || '正在确认发送状态…'
  }
  async function refreshQueue() {
    if (!mailIsActive.value || queueRefreshing || disposed) return
    queueRefreshing = true; lastQueueRefresh = Date.now()
    try {
      const live = pendingSends.value.filter(row => ['queued', 'dispatching', 'sending'].includes(row.status))
      if (!live.length) {
        const result = await fetchMailOutboxes()
        if (!disposed) pendingSends.value = [...result.filter(row => ['queued', 'dispatching', 'sending', 'failed', 'uncertain', 'blocked'].includes(row.status)), ...pendingSends.value.filter(row => !['queued', 'dispatching', 'sending'].includes(row.status) && !result.some(incoming => incoming.id === row.id))].slice(0, 10)
      } else {
        const results = await Promise.allSettled(live.map(row => fetchMailOutbox(row.id)))
        for (const result of results) {
          if (disposed || result.status !== 'fulfilled') continue
          const item = result.value
          pendingSends.value = pendingSends.value.map(row => row.id === item.id ? item : row)
          if (['sent', 'submitted'].includes(item.status)) { sendDrafts.delete(item.id); void loadFolders(true); if (isDraftFolder.value) void loadMessages(false, true) }
        }
      }
    } catch { /* Keep the server-confirmed state visible until the next refresh. */ }
    finally { queueRefreshing = false }
  }
  async function undoSend(item: MailOutbox) {
    cancelBusy.value = item.id
    try {
      const result = await cancelMailOutbox(item.id)
      pendingSends.value = pendingSends.value.map(row => row.id === item.id ? result : row)
      if (result.status === 'cancelled') { let draft = sendDrafts.get(item.id); if (result.draft_id || draft?.id) { try { draft = await fetchMailDraft(result.draft_id || draft!.id) } catch { notice.value = '发送已撤销，可以从草稿箱继续编辑。' } }; if (draft) { composeWarning.value = ''; try { localStorage.removeItem(`atoman.mail.send.${draft.id}.${draft.revision || 0}`) } catch { /* optional storage */ }; composeDraft.value = draft }; sendDrafts.delete(item.id) }
    } catch (error) { notice.value = messageError(error, '撤销尚未确认，正在检查发送状态。'); await refreshQueue() }
    finally { cancelBusy.value = '' }
  }
  async function checkSend(item: MailOutbox) {
    cancelBusy.value = item.id
    try { const result = await reconcileMailOutbox(item.id); pendingSends.value = pendingSends.value.map(row => row.id === item.id ? result : row); if (result.status === 'uncertain') notice.value = '暂时无法确认发送结果，请稍后再检查。请勿重复发送。' }
    catch (error) { notice.value = messageError(error, '还不能确认发送结果，请稍后再检查。') }
    finally { cancelBusy.value = '' }
  }
  async function provisionAccount() {
    loadingAccount.value = true; accountError.value = ''
    try { mailAccount.value = await provisionMailAccount(); if (mailIsActive.value) { await loadFolders(); await loadMessages() } }
    catch (error) { accountError.value = messageError(error, '邮箱开通尚未完成，请稍后重试。') }
    finally { loadingAccount.value = false }
  }
  async function performAction(action: MailAction, explicitIds?: string[], targetMailboxId?: string) {
    if (actionBusy.value) return
    const ids = explicitIds || [...selection.value]
    if (!ids.length) return
    if (ids.length > 100) { notice.value = '一次最多操作 100 封邮件，请从列表分批选择。'; return }
    actionBusy.value = true
    try {
      const result = await mutateMailMessages(currentFolderId.value, ids, action, targetMailboxId)
      actionUndo.value = result.undo_id || ''; selection.value = new Set()
      const names: Partial<Record<MailAction, string>> = { archive: '已归档', trash: '已移到回收站', junk: '已移到垃圾邮件', restore: '已恢复到收件箱', move: '已移动', read: '已标为已读', unread: '已标为未读', flag: '已添加星标', unflag: '已取消星标' }
      notice.value = `${names[action] || '已更新'} ${result.affected} 封邮件。${result.failed?.length ? `另有 ${result.failed.length} 封未更新，请刷新后重试。` : ''}`
      const changed = new Set(result.updated || ids)
      if (['archive', 'trash', 'junk', 'restore', 'move'].includes(action) && readerMessages.value.some(row => changed.has(row.id))) clearReader()
      else {
        readerMessages.value = readerMessages.value.map(row => changed.has(row.id) ? { ...row, ...(['read', 'unread'].includes(action) ? { isRead: action === 'read' } : {}), ...(['flag', 'unflag'].includes(action) ? { isFlagged: action === 'flag' } : {}) } : row)
        for (const id of changed) if (details.value[id] && ['read', 'unread'].includes(action)) details.value[id]!.isRead = action === 'read'
      }
      await loadMessages(false, true); await loadFolders(true)
    } catch (error) { notice.value = messageError(error, '操作没有完成，请刷新后重试。') }
    finally { actionBusy.value = false }
  }
  async function undoAction() {
    if (!actionUndo.value || actionBusy.value) return
    actionBusy.value = true
    try { await undoMailAction(actionUndo.value); actionUndo.value = ''; notice.value = '操作已撤销。'; clearReader(); await loadFolders(true); await loadMessages(false, true) }
    catch (error) { notice.value = messageError(error, '这次操作暂时无法撤销，请刷新查看邮件状态。') }
    finally { actionBusy.value = false }
  }
  function moveSelected(event: Event) { const select = event.target as HTMLSelectElement; if (select.value) void performAction('move', undefined, select.value); select.value = '' }
  async function downloadAttachment(message: MailSummary, attachment: MailAttachmentInfo) {
    try { if (!attachment.partId) throw new Error('missing part'); await downloadMailAttachment(message.id, attachment.partId, attachment.name) }
    catch { notice.value = '附件暂时无法下载，请重新打开邮件后重试。' }
  }
  async function blockSender(detail: MailDetail) {
    const sender = detail.from[0]?.email
    if (!sender || actionBusy.value) return
    actionBusy.value = true
    try { const prefs = await fetchMailPreferences(); prefs.blocked_senders = [...new Set([...prefs.blocked_senders, sender.toLowerCase()])]; await saveMailPreferences(prefs); notice.value = `已拦截 ${sender}，之后的来信将移到垃圾邮件。` }
    catch (error) { notice.value = messageError(error, '拦截设置未保存，请重试。'); return }
    finally { actionBusy.value = false }
    await performAction('junk', [detail.id])
  }
  async function addFolder() {
    if (!newFolderName.value.trim() || folderWorking.value) return
    folderWorking.value = true; folderError.value = ''
    try { const folder = await createMailFolder(newFolderName.value.trim()); await loadFolders(true); folderDialog.value = false; newFolderName.value = ''; selectFolder(folder.id) }
    catch (error) { folderError.value = messageError(error, '文件夹未创建，请检查名称后重试。') }
    finally { folderWorking.value = false }
  }
  async function removeFolder() {
    const folder = currentFolder.value
    if (!folder || folder.role || folderWorking.value) return
    folderWorking.value = true; folderError.value = ''
    try { await deleteMailFolder(folder.id); deleteFolderDialog.value = false; await loadFolders(); await loadMessages() }
    catch (error) { folderError.value = messageError(error, '文件夹未删除。请先移走其中的邮件，再重试。') }
    finally { folderWorking.value = false }
  }
  async function claimAddress() {
    if (!isChosenLocalValid.value || redeeming.value) return
    redeeming.value = true; redeemError.value = ''
    try {
      mailAccount.value = isMailAdministrator.value ? await reserveAdminMailAddress(chosenLocalPart.value.trim().toLowerCase()) : await redeemMailInvitation(invitation.value.trim(), chosenLocalPart.value.trim().toLowerCase())
      invitation.value = ''
      if (mailIsActive.value) { await loadFolders(); await loadMessages() }
    } catch (error) { redeemError.value = messageError(error, '开通未完成，请检查邀请码和邮箱名称后重试。') }
    finally { redeeming.value = false }
  }
  function onVisibilityChange() { if (document.visibilityState !== 'visible') return; for (const message of readerMessages.value) if (expanded.value.has(message.id) && details.value[message.id]) void markDisplayedRead(message, readerGeneration); void refreshQueue() }
  watch(conversationMode, value => { try { localStorage.setItem('atoman.mail.conversations', String(value)) } catch { /* preference storage is optional */ }; selection.value = new Set(); clearReader() })
  watch(mobilePane, async pane => { if (pane === 'reader') { await nextTick(); for (const message of readerMessages.value) if (expanded.value.has(message.id) && details.value[message.id]) void markDisplayedRead(message, readerGeneration) } })
  onMounted(() => {
    try { conversationMode.value = localStorage.getItem('atoman.mail.conversations') !== 'false' } catch { /* default conversation mode */ }
    void refreshMailbox()
    refreshTimer = setInterval(() => { if (document.visibilityState === 'visible' && mailIsActive.value && !composeDraft.value && !settingsOpen.value && !loadingMessages.value && !actionBusy.value) { void loadMessages(false, true); void loadFolders(true) } }, 30000)
    clockTimer = setInterval(() => { now.value = Date.now(); if (document.visibilityState === 'visible' && pendingSends.value.some(row => ['queued', 'dispatching', 'sending'].includes(row.status)) && Date.now() - lastQueueRefresh >= (pendingSends.value.some(row => row.status === 'queued') ? 1000 : 5000)) void refreshQueue() }, 1000)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => { disposed = true; accountGeneration++; folderGeneration++; messageGeneration++; readerGeneration++; clearInterval(refreshTimer); clearInterval(clockTimer); document.removeEventListener('visibilitychange', onVisibilityChange) })
  return { advancedOpen,advancedFilters,allFolders,setAdvancedSearch,clearAdvancedSearch, mailAccount, loadingAccount, accountError, mailIsActive, isMailAdministrator, statusLabel, statusTitle, statusDescription, invitation, chosenLocalPart, isChosenLocalValid, redeeming, redeemError, claimAddress, folders, foldersLoading, foldersError, currentFolder, currentFolderId, folderLabel, mobilePane, messages, drafts, loadingMessages, messagesError, searchText, committedSearch, totalMessages, conversations, conversationMode, selection, selectedGroupId, allSelected, selectAll, toggleGroup, selectFolder, loadMessages, refreshMailbox, runSearch, hasMore, openConversation, readerMessages, expanded, details, detailErrors, detailLoading, htmlShown, threadError, toggleExpanded, loadDetail, newMessage, editDraft, composeDraft, composeWarning, settingsOpen, replyTo, forwardMessage, onDraftSaved, onQueued, pendingSends, remainingSeconds, queueLabel, undoSend, checkSend, refreshQueue, provisionAccount, cancelBusy, notice, actionUndo, actionBusy, performAction, undoAction, moveSelected, downloadAttachment, downloadSource, blockSender, folderDialog, deleteFolderDialog, newFolderName, folderError, folderWorking, addFolder, removeFolder, isDraftFolder, clearReader }
}
