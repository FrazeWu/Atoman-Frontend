<template>
  <section class="mail-page" data-testid="mail-workspace">
    <header class="mail-page__header">
      <div class="mail-page__identity"><span class="mail-page__eyebrow">AToMAN · MAIL</span><h1>电子邮件</h1><p>{{ mailAccount?.address || '管理电子邮箱' }}</p></div>
      <div class="mail-page__actions"><PBadge v-if="mailIsActive" class="mail-page__status" type="success" label="已连接" /><button v-if="mailIsActive" class="mail-icon-button" aria-label="邮箱设置" @click="settingsOpen = true"><Settings :size="19" /></button><button class="mail-icon-button" aria-label="刷新邮箱" :disabled="loadingAccount" @click="refreshMailbox"><RefreshCw :size="18" :class="{ 'mail-spin': loadingAccount }" /></button></div>
    </header>
    <div v-if="loadingAccount && !mailAccount" class="mail-gate"><RefreshCw class="mail-spin" :size="24" /><p>正在连接邮箱…</p></div>
    <div v-else-if="!mailIsActive" class="mail-gate" data-testid="mail-not-active">
      <div class="mail-gate__icon"><Mail :size="30" :stroke-width="1.4" /></div><span class="mail-gate__eyebrow">{{ statusLabel }}</span><h2>{{ statusTitle }}</h2><p>{{ statusDescription }}</p>
      <p v-if="accountError" role="alert" class="mail-error">{{ accountError }}</p>
      <form v-if="mailAccount?.status === 'not_invited' || mailAccount?.status === 'not_ready'" class="mail-gate__redeem" :data-testid="isMailAdministrator ? 'mail-admin-reserve-form' : 'mail-invite-redeem-form'" @submit.prevent="claimAddress">
        <PInput v-if="!isMailAdministrator" id="mail-invitation" v-model="invitation" label="邀请码" autocomplete="off" placeholder="输入你的邀请码" required />
        <PInput id="mail-local-name" v-model="chosenLocalPart" label="邮箱名称" autocapitalize="off" autocomplete="off" placeholder="你的邮箱名称" minlength="3" maxlength="32" required><template #suffix>@atoman.org</template></PInput>
        <p v-if="redeemError" class="mail-error" role="alert">{{ redeemError }}</p><PButton type="submit" :disabled="redeeming || !isChosenLocalValid || (!isMailAdministrator && !invitation.trim())">{{ redeeming ? '正在开通…' : '开通邮箱' }}</PButton>
      </form>
      <PButton v-else-if="mailAccount?.status === 'reserved'" :disabled="loadingAccount" @click="provisionAccount">{{ loadingAccount ? '正在开通…' : '完成开通' }}</PButton><PButton v-else variant="secondary" @click="refreshMailbox">重新检查</PButton>
    </div>
    <template v-else>
      <div v-if="notice || actionUndo" class="mail-workspace__notice" role="status"><span>{{ notice }}</span><button v-if="actionUndo" :disabled="actionBusy" @click="undoAction">撤销操作</button><button class="mail-icon-button" aria-label="关闭提示" @click="notice = ''; actionUndo = ''"><X :size="15" /></button></div>
      <div v-for="item in pendingSends" :key="item.id" class="mail-workspace__queue" role="status"><span>{{ queueLabel(item) }}</span><button v-if="item.status === 'queued'" :disabled="cancelBusy === item.id || remainingSeconds(item) === 0" @click="undoSend(item)">{{ cancelBusy === item.id ? '正在撤销…' : '撤销发送' }}<span v-if="remainingSeconds(item) > 0"> · {{ remainingSeconds(item) }}s</span></button><button v-if="item.status === 'uncertain'" :disabled="cancelBusy === item.id" @click="checkSend(item)">检查发送结果</button><button v-if="!['dispatching', 'sending', 'queued'].includes(item.status)" class="mail-icon-button" aria-label="关闭发送状态" @click="pendingSends = pendingSends.filter(row => row.id !== item.id)"><X :size="15" /></button></div>
      <div class="mail-workspace" data-testid="mail-active-workspace">
        <aside class="mail-workspace__folders" :class="{ 'mail-mobile-visible': mobilePane === 'folders' }" data-testid="mail-folder-pane">
          <div class="mail-workspace__folders-header"><span class="mail-workspace__section-label">邮件文件夹</span><PButton class="mail-workspace__new" block @click="newMessage"><Pencil :size="16" /> 写邮件</PButton></div>
          <p v-if="foldersError" class="mail-error" role="alert">{{ foldersError }}</p><p v-if="foldersLoading && !folders.length" class="mail-workspace__list-state">正在加载文件夹…</p>
          <nav class="mail-workspace__folder-list" aria-label="邮件文件夹"><button v-for="folder in folders" :key="folder.id" class="mail-workspace__folder" :class="{ 'is-active': currentFolderId === folder.id }" :aria-current="currentFolderId === folder.id ? 'page' : undefined" @click="selectFolder(folder.id)"><component :is="folderIcon(folder.role)" :size="17" aria-hidden="true" /><span class="mail-workspace__folder-name">{{ folderLabel(folder) }}</span><small v-if="folder.unreadEmails" class="mail-workspace__folder-count" :aria-label="`${folder.unreadEmails} 封未读`">{{ folder.unreadEmails > 999 ? '999+' : folder.unreadEmails }}</small></button></nav>
          <div v-if="organizerState.labels.length" class="mail-organizer__sidebar-labels">
            <small>我的标签（当前文件夹）</small>
            <button v-for="label in organizerState.labels" :key="label.id" :aria-pressed="organizerFilterId===label.id" @click="organizerFilterId=organizerFilterId===label.id?'':label.id"># {{ label.name }}</button>
            <button v-if="organizerFilterId" @click="organizerFilterId=''">清除标签筛选</button>
          </div>
          <div class="mail-workspace__folder-tools"><button @click="externalOpen=true"><Inbox :size="14" /> 聚合邮箱</button><button @click="openMailOrganizer()"><Tags :size="14" /> 提醒与标签<span v-if="dueOrganizerCount"> · {{ dueOrganizerCount }}</span></button><button @click="scheduledOpen=true"><Clock :size="14" /> 定时发送与状态</button><button @click="folderDialog = true"><Plus :size="14" /> 新建文件夹</button><button v-if="currentFolder && !currentFolder.role" @click="deleteFolderDialog = true"><Trash2 :size="14" /> 删除当前文件夹</button></div>
          <p class="mail-workspace__sidebar-foot">回收站和垃圾邮件保留 30 天</p>
        </aside>
        <section class="mail-workspace__list" :class="{ 'mail-mobile-visible': mobilePane === 'list' }" data-testid="mail-list-pane">
          <header class="mail-workspace__list-header"><button class="mail-icon-button mail-workspace__mobile-back" aria-label="显示文件夹" @click="mobilePane = 'folders'"><ChevronLeft :size="18" /></button><div class="mail-workspace__heading"><h2>{{ currentFolder ? folderLabel(currentFolder) : '邮件' }}</h2><small>{{ isDraftFolder ? drafts.length : totalMessages }} 封邮件</small></div><PButton class="mail-workspace__mobile-compose" size="sm" variant="secondary" aria-label="写邮件" @click="newMessage"><Pencil :size="15" /> 写邮件</PButton><button class="mail-icon-button" title="刷新邮件列表" aria-label="刷新邮件列表" :disabled="loadingMessages" @click="loadMessages(false, true)"><RefreshCw :size="17" :class="{ 'mail-spin': loadingMessages }" /></button></header>
          <div v-if="!isDraftFolder" class="mail-workspace__search-container"><PSearchInput v-model="searchText" class="mail-workspace__search" variant="inline" size="sm" placeholder="搜索发件人、主题或正文" aria-label="搜索邮件" :show-shortcut-badge="false" :show-action-button="true" action-button-text="搜索" @search="runSearch" @clear="runSearch" /><PButton type="button" variant="secondary" size="sm" class="mail-workspace__advanced-trigger" :aria-label="allFolders || Object.values(advancedFilters).some(v=>v !== undefined && v !== '') ? '编辑高级筛选' : '高级筛选'" @click="advancedOpen=true"><SlidersHorizontal :size="16" /></PButton></div>
          <button v-if="allFolders || Object.values(advancedFilters).some(v=>v !== undefined && v !== '')" class="mail-workspace__filter-note" @click="clearAdvancedSearch">高级筛选已启用 · 点击清除</button>
          <div v-if="!isDraftFolder" class="mail-workspace__list-options"><label><input type="checkbox" :checked="allVisibleSelected" aria-label="选择当前列表全部邮件" @change="selectVisibleAll" /><span>{{ selection.size ? `已选 ${selection.size} 封` : '选择' }}</span></label><PSegmentedControl class="mail-workspace__view-mode" :model-value="conversationMode ? 'thread' : 'single'" :options="[{ label: '会话', value: 'thread' }, { label: '单封', value: 'single' }]" @update:model-value="conversationMode = $event === 'thread'" /></div>
          <Transition name="mail-bulk-slide">
            <div v-if="selection.size" class="mail-workspace__bulk" aria-label="批量操作">
              <PButton variant="ghost" size="sm" title="归档" aria-label="归档所选邮件" :disabled="actionBusy" @click="performAction('archive')"><Archive :size="17" /></PButton>
              <PButton variant="ghost" size="sm" title="标为已读" aria-label="将所选邮件标为已读" :disabled="actionBusy" @click="performAction('read')"><MailOpen :size="17" /></PButton>
              <PButton variant="ghost" size="sm" title="标为未读" aria-label="将所选邮件标为未读" :disabled="actionBusy" @click="performAction('unread')"><Mail :size="17" /></PButton>
              <PButton variant="ghost" size="sm" title="移到回收站" aria-label="删除所选邮件" :disabled="actionBusy" @click="performAction('trash')"><Trash2 :size="17" /></PButton>
              <PSelect class="mail-workspace__move-select" label="移动所选邮件" :model-value="null" placeholder="移动到…" :disabled="actionBusy" :options="folders.filter(row => row.id !== currentFolderId).map(row => ({ value: row.id, label: folderLabel(row) }))" @update:model-value="performAction('move', undefined, String($event))" />
              <button type="button" class="mail-icon-button mail-workspace__bulk-clear" title="取消选择" aria-label="取消选择" @click="clearSelection"><X :size="15" /></button>
            </div>
          </Transition>
          <div class="mail-workspace__messages" aria-live="polite">
            <div v-if="messagesError" class="mail-workspace__list-state" role="alert"><CircleAlert :size="22" /><p>{{ messagesError }}</p><button @click="loadMessages()">重试</button></div>
            <div v-else-if="loadingMessages && !messages.length && !drafts.length" class="mail-workspace__list-state"><RefreshCw class="mail-spin" :size="22" /><p>正在加载…</p></div>
            <template v-else-if="isDraftFolder"><button v-for="draft in drafts" :key="draft.id" class="mail-workspace__message" @click="editDraft(draft)"><span class="mail-workspace__message-first"><span class="mail-workspace__message-subject">{{ draft.subject || '未命名草稿' }}</span><small>{{ mailTime(draft.updated_at || '') }}</small></span><span class="mail-workspace__message-preview">{{ draft.text || '继续编辑' }}</span></button><div v-if="!drafts.length" class="mail-workspace__list-state"><PEmpty compact align="center" title="这里还没有草稿" description="写邮件时会自动保存草稿。"><template #icon><FileText :size="26" /></template></PEmpty></div></template>
            <template v-else><div v-for="group in visibleConversations" :key="group.id" class="mail-workspace__message-row" :class="{ 'is-selected': selectedGroupId === group.id, 'is-unread': group.messages.some(row => row.isRead === false) }"><label class="mail-workspace__row-check"><input type="checkbox" :checked="group.messages.every(row => selection.has(row.id))" :aria-label="`选择：${group.latest.subject || '无主题'}`" @change="toggleGroup(group)" /></label><button class="mail-workspace__message" :data-testid="`mail-message-${group.latest.id}`" @click="openConversation(group)"><span class="mail-workspace__sender">{{ addressText(group.latest.from || []) || '邮件' }}<span v-if="group.messages.length > 1"> · {{ group.messages.length }}</span><Star v-if="group.latest.isFlagged" :size="12" fill="currentColor" /></span><span class="mail-workspace__message-first"><span class="mail-workspace__message-subject">{{ group.latest.subject || '无主题' }}</span><small>{{ mailTime(group.latest.receivedAt) }}</small></span><span class="mail-workspace__message-preview">{{ group.latest.preview || '没有摘要' }}</span><span v-if="group.latest.hasAttachment" class="mail-workspace__attachment"><Paperclip :size="12" /> 附件</span></button></div><div v-if="!visibleConversations.length" class="mail-workspace__list-state"><PEmpty compact align="center" :title="committedSearch ? '没有找到匹配的邮件' : '此文件夹暂无邮件'" :description="committedSearch ? '试试更短的关键词或清空搜索。' : '新的邮件会显示在这里。'"><template #icon><Inbox :size="28" /></template></PEmpty></div><button v-if="hasMore" class="mail-workspace__load-more" :disabled="loadingMessages" @click="loadMessages(true)">{{ loadingMessages ? '加载中…' : '加载更多' }}</button></template>
          </div>
        </section>
        <!-- 浮动框设计：参考图书与音乐模块，点击邮件弹出详情（全宽设计规范，左侧轨支持上下切换邮件） -->
        <PSheet
          :show="isReaderOpen"
          :title="activeSubject"
          mode="full"
          content-max-width="96rem"
          :side="isMobile ? 'bottom' : 'right'"
          panel-class="mail-workspace__reader-sheet"
          :navigation="navigation"
          :navigation-key="selectedGroupId || ''"
          :navigation-direction="navigationDirection"
          :navigation-loading="navigationLoading"
          @close="handleCloseReader"
          @navigate="handleSheetNavigate"
        >
          <article class="mail-workspace__reader" :class="{ 'mail-mobile-visible': mobilePane === 'reader' }" data-testid="mail-reader-pane">
            <template v-if="readerMessages.length">
              <header class="mail-workspace__reader-head">
                <div class="mail-workspace__nav-group" aria-label="切换邮件">
                  <button
                    type="button"
                    class="mail-icon-button"
                    :disabled="!navigation.previous || navigationLoading"
                    :aria-label="navigation.previous ? `上一封：${navigation.previous.label}` : '没有上一封'"
                    :title="navigation.previous ? `上一封：${navigation.previous.label} (K)` : '没有上一封'"
                    @click="handleSheetNavigate('previous')"
                  >
                    <ChevronUp :size="16" />
                  </button>
                  <button
                    type="button"
                    class="mail-icon-button"
                    :disabled="!navigation.next || navigationLoading"
                    :aria-label="navigation.next ? `下一封：${navigation.next.label}` : '没有下一封'"
                    :title="navigation.next ? `下一封：${navigation.next.label} (J)` : '没有下一封'"
                    @click="handleSheetNavigate('next')"
                  >
                    <ChevronDown :size="16" />
                  </button>
                </div>
                <div class="mail-workspace__reader-tools">
                  <button class="mail-icon-button" aria-label="为邮件添加提醒或标签" title="提醒与标签" :disabled="organizerBusy" @click="openMailOrganizer(readerMessages[readerMessages.length-1])"><Tags :size="16" /></button>
                  <button class="mail-icon-button" aria-label="归档会话" title="归档 (E)" :disabled="actionBusy" @click="archiveAndAdvance"><Archive :size="16" /></button>
                  <button v-if="currentFolder?.role === 'trash' || currentFolder?.role === 'junk'" class="mail-icon-button" aria-label="恢复到收件箱" title="恢复到收件箱" :disabled="actionBusy" @click="performAction('restore', readerMessages.map(row => row.id))"><Undo2 :size="16" /></button>
                  <button class="mail-icon-button" aria-label="移到垃圾邮件" title="移到垃圾邮件 (!)" :disabled="actionBusy" @click="performAction('junk', readerMessages.map(row => row.id))"><ShieldAlert :size="16" /></button>
                  <button class="mail-icon-button" aria-label="删除会话" title="删除会话 (#)" :disabled="actionBusy" @click="trashAndAdvance"><Trash2 :size="16" /></button>
                </div>
                <div class="mail-workspace__reader-head-right">
                  <PBadge class="mail-workspace__read-tag" type="info" no-dot :label="readerMessages.length > 1 ? `${readerMessages.length} 封邮件` : '邮件'" />
                  <button class="mail-icon-button mail-workspace__reader-close-btn" aria-label="关闭邮件" title="关闭邮件 (Esc)" @click="handleCloseReader"><X :size="16" /></button>
                </div>
              </header>
              <div class="mail-workspace__reader-body" data-testid="mail-selected-preview">
                <h2>{{ readerMessages[readerMessages.length - 1]?.subject || '无主题' }}</h2>
                <p v-if="threadError" class="mail-error" role="alert">{{ threadError }}</p>
                <section v-for="message in readerMessages" :key="message.id" class="mail-workspace__thread-card">
                  <button class="mail-workspace__thread-summary" :aria-expanded="expanded.has(message.id)" @click="toggleExpanded(message)">
                    <span><strong>{{ addressText(message.from || []) || '邮件' }}</strong><small v-if="!expanded.has(message.id)">{{ message.preview }}</small></span>
                    <time>{{ mailTime(message.receivedAt, true) }}</time>
                    <ChevronDown v-if="expanded.has(message.id)" :size="16" />
                    <ChevronRight v-else :size="16" />
                  </button>
                  <div v-if="expanded.has(message.id)" class="mail-workspace__thread-content">
                    <div v-if="detailLoading.has(message.id)" class="mail-workspace__detail-status"><RefreshCw class="mail-spin" :size="18" /> 正在打开邮件…</div>
                    <div v-else-if="detailErrors[message.id]" class="mail-workspace__detail-status" role="alert"><p>{{ detailErrors[message.id] }}</p><button @click="loadDetail(message)">重新打开</button></div>
                    <template v-else-if="details[message.id]">
                      <dl class="mail-workspace__address-meta">
                        <div><dt>发件人</dt><dd>{{ addressText(details[message.id]!.from) }}</dd></div>
                        <div><dt>收件人</dt><dd>{{ addressText(details[message.id]!.to) }}</dd></div>
                        <div v-if="details[message.id]!.cc.length"><dt>抄送</dt><dd>{{ addressText(details[message.id]!.cc) }}</dd></div>
                      </dl>
                      <div v-if="details[message.id]!.html" class="mail-workspace__format-choice">
                        <button @click="htmlShown[message.id] = !htmlShown[message.id]">{{ htmlShown[message.id] ? '显示纯文本' : '显示排版' }}</button>
                        <span v-if="htmlShown[message.id]">外部图片已隐藏</span>
                      </div>
                      <iframe v-if="htmlShown[message.id] && details[message.id]!.html" class="mail-workspace__html-frame" title="邮件正文" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" :srcdoc="mailFrameDocument(details[message.id]!.html || '')" />
                      <p v-else class="mail-workspace__plain-body" data-testid="mail-plain-text">{{ details[message.id]!.plainText || (details[message.id]!.html ? '此邮件只有排版正文，请选择「显示排版」。' : '这封邮件没有正文。') }}</p>
                      <p v-if="details[message.id]!.bodyTruncated" class="mail-workspace__body-warning">正文较长，当前显示部分内容。<button @click="downloadSource(details[message.id]!)">下载完整邮件</button></p>
                      <div v-if="details[message.id]!.attachments.length" class="mail-workspace__attachments">
                        <button v-for="(attachment, index) in details[message.id]!.attachments" :key="`${attachment.partId || index}-${attachment.name}`" class="mail-workspace__attachment-row" @click="previewAttachment(message, attachment)" :aria-label="'预览或下载附件 '+(attachment.name||'附件')"><Paperclip :size="14" /><span>{{ attachment.name || '附件' }} · {{ fileSize(attachment.size) }}</span><Download :size="14" /></button>
                      </div>
                      <div class="mail-workspace__reply-actions">
                        <PButton size="sm" variant="secondary" @click="replyTo(details[message.id]!, false)"><Reply :size="15" /> 回复</PButton>
                        <PButton size="sm" variant="secondary" @click="replyTo(details[message.id]!, true)"><ReplyAll :size="15" /> 全部回复</PButton>
                        <PButton size="sm" variant="secondary" :disabled="actionBusy" @click="forwardMessage(details[message.id]!)"><Forward :size="15" /> 转发</PButton>
                        <PButton size="sm" variant="ghost" :aria-label="message.isFlagged ? '取消星标' : '添加星标'" :disabled="actionBusy" @click="performAction(message.isFlagged ? 'unflag' : 'flag', [message.id])"><Star :size="15" :fill="message.isFlagged ? 'currentColor' : 'none'" /></PButton>
                        <PButton v-if="details[message.id]!.from[0]?.email !== mailAccount?.address" size="sm" variant="ghost" title="拦截发件人并移到垃圾邮件" :disabled="actionBusy" @click="blockSender(details[message.id]!)"><ShieldAlert :size="15" /> 拦截</PButton>
                      </div>
                    </template>
                  </div>
                </section>
              </div>
            </template>
          </article>
        </PSheet>
      </div>
      <PModal :show="shortcutHelp" title="邮箱快捷键" size="sm" @close="shortcutHelp=false">
        <dl class="mail-shortcuts">
          <dt>C</dt><dd>写邮件</dd>
          <dt>J / K</dt><dd>下一封 / 上一封</dd>
          <dt>Enter / O</dt><dd>打开邮件</dd>
          <dt>R</dt><dd>回复</dd>
          <dt>A</dt><dd>全部回复</dd>
          <dt>F</dt><dd>转发</dd>
          <dt>E</dt><dd>归档并读下一封</dd>
          <dt># / Del</dt><dd>移入回收站</dd>
          <dt>S</dt><dd>标记或取消星标</dd>
          <dt>U</dt><dd>标为未读并返回</dd>
          <dt>/</dt><dd>聚焦搜索</dd>
          <dt>?</dt><dd>快捷键帮助</dd>
          <dt>Esc</dt><dd>关闭浮动框 / 返回</dd>
        </dl>
      </PModal>
      <MailOrganizerPanel v-if="organizerOpen" :state="organizerState" :target="organizerTarget" :messages="messages" :now="organizerNow" :busy="organizerBusy" :error="organizerError" @close="organizerOpen=false" @action="onOrganizerAction" @create-label="onCreateOrganizerLabel" @delete-label="onDeleteOrganizerLabel" @update-label="onUpdateOrganizerLabel" />
      <MailExternalAccounts v-if="externalOpen" @close="externalOpen=false" @open-native="openNativeFromAggregate" />
      <MailScheduledPanel v-if="scheduledOpen" :items="pendingSends" :busy-id="cancelBusy" @close="scheduledOpen=false" @refresh="refreshQueue" @cancel="undoSend" />
      <MailAttachmentPreview v-if="attachmentPreview" :key="attachmentPreview.messageId+attachmentPreview.attachment.partId" :message-id="attachmentPreview.messageId" :attachment="attachmentPreview.attachment" @close="attachmentPreview=null" />
      <MailComposer v-if="composeDraft" :key="composeDraft.id" :address="mailAccount?.address || ''" :draft="composeDraft" :warning="composeWarning" @close="composeDraft = null" @saved="onDraftSaved" @queued="onQueued" />
      <MailAdvancedSearch v-if="advancedOpen" :filters="advancedFilters" :everywhere="allFolders" @close="advancedOpen=false" @apply="setAdvancedSearch" />
      <MailSettings v-if="settingsOpen" :address="mailAccount?.address || ''" :folders="folders" @close="settingsOpen = false" />
      <PModal :show="folderDialog" title="新建文件夹" size="sm" @close="folderDialog = false"><form class="mail-workspace__folder-form" @submit.prevent="addFolder"><PInput id="new-mail-folder" v-model="newFolderName" label="文件夹名称" maxlength="100" required autofocus /><p v-if="folderError" class="mail-error" role="alert">{{ folderError }}</p><PButton type="submit" :disabled="folderWorking || !newFolderName.trim()">{{ folderWorking ? '创建中…' : '创建' }}</PButton></form></PModal>
      <PModal :show="deleteFolderDialog" title="删除文件夹" size="sm" @close="deleteFolderDialog = false"><p>删除「{{ currentFolder?.name }}」？只有空文件夹可以删除。</p><p v-if="folderError" class="mail-error" role="alert">{{ folderError }}</p><template #footer><PButton variant="secondary" @click="deleteFolderDialog = false">取消</PButton><PButton :disabled="folderWorking" @click="removeFolder">删除文件夹</PButton></template></PModal>
    </template>
  </section>
</template>
<script setup lang="ts">
import { Clock, Tags, SlidersHorizontal, Archive, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CircleAlert, Download, FileText, Folder, Forward, Inbox, Mail, MailOpen, Paperclip, Pencil, Plus, RefreshCw, Reply, ReplyAll, Send, Settings, ShieldAlert, Star, Trash2, Undo2, X } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PSearchInput from '@/components/ui/PSearchInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSheet from '@/components/ui/PSheet.vue'
import MailComposer from './MailComposer.vue'
import MailAdvancedSearch from './MailAdvancedSearch.vue'
import MailAttachmentPreview from './MailAttachmentPreview.vue'
import MailScheduledPanel from './MailScheduledPanel.vue'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useSheetNavigation, type SheetNavigationDirection } from '@/composables/useSheetNavigation'
import type { MailSummary, MailAttachmentInfo } from '@/api/mail'
import MailSettings from './MailSettings.vue'
import MailExternalAccounts from './MailExternalAccounts.vue'
import MailOrganizerPanel from './MailOrganizerPanel.vue'
import { fetchMailOrganizer, createMailOrganizerLabel, updateMailOrganizerLabel, deleteMailOrganizerLabel, mutateMailOrganizer, type MailOrganizerState, type MailOrganizerMutation, type MailOrganizerColor } from '@/api/mailClient'
import { addressText, fileSize, mailFrameDocument, mailTime } from './mail-helpers'
import { useMailWorkspace } from './useMailWorkspace'
const { advancedOpen,advancedFilters,allFolders,setAdvancedSearch,clearAdvancedSearch, mailAccount, loadingAccount, accountError, mailIsActive, isMailAdministrator, statusLabel, statusTitle, statusDescription, invitation, chosenLocalPart, isChosenLocalValid, redeeming, redeemError, claimAddress, folders, foldersLoading, foldersError, currentFolder, currentFolderId, folderLabel, mobilePane, messages, drafts, loadingMessages, messagesError, searchText, committedSearch, totalMessages, conversations, conversationMode, selection, selectedGroupId, allSelected, selectAll, toggleGroup, selectFolder, loadMessages, refreshMailbox, runSearch, hasMore, openConversation, readerMessages, expanded, details, detailErrors, detailLoading, htmlShown, threadError, toggleExpanded, loadDetail, newMessage, editDraft, composeDraft, composeWarning, settingsOpen, replyTo, forwardMessage, onDraftSaved, onQueued, pendingSends, remainingSeconds, queueLabel, undoSend, checkSend, refreshQueue, provisionAccount, cancelBusy, notice, actionUndo, actionBusy, performAction, undoAction, downloadAttachment, downloadSource, blockSender, folderDialog, deleteFolderDialog, newFolderName, folderError, folderWorking, addFolder, removeFolder, isDraftFolder, clearReader } = useMailWorkspace()
const shortcutHelp=ref(false)
const scheduledOpen=ref(false)
const externalOpen=ref(false)
const organizerOpen=ref(false),organizerFilterId=ref('')
const organizerTarget=ref<MailSummary|null>(null)
const organizerState=ref<MailOrganizerState>({labels:[],records:[]})
const organizerBusy=ref(false),organizerError=ref('')
const organizerNow=ref(Date.now())

const isMobile = ref(false)
let viewport: MediaQueryList | undefined
function syncViewport() { isMobile.value = viewport?.matches ?? false }

const activeSubject = computed(() => readerMessages.value[readerMessages.value.length - 1]?.subject || '邮件详情')

const organizerById=computed(()=>new Map(organizerState.value.records.map(item=>[item.message_id,item])))
const dueOrganizerCount=computed(()=>organizerState.value.records.filter(item=>item.follow_up_at && new Date(item.follow_up_at).getTime()<=organizerNow.value).length)
const isMessageSnoozed=(message:MailSummary)=> {
  const when=organizerById.value.get(message.id)?.snooze_until
  return !!when && new Date(when).getTime()>organizerNow.value
}
const visibleConversations=computed(()=>{
  const scoped=organizerFilterId.value ? conversations.value.filter(group=>group.messages.some(msg=>organizerById.value.get(msg.id)?.label_ids.includes(organizerFilterId.value))) : conversations.value
  if(organizerFilterId.value || currentFolder.value?.role!=='inbox' || committedSearch.value || allFolders.value)return scoped
  return scoped.filter(group=>!isMessageSnoozed(group.latest))
})

const isReaderOpen = computed(() => Boolean(selectedGroupId.value && readerMessages.value.length))

const loadMailNavigationItems = async () => {
  return visibleConversations.value.map(group => ({
    id: group.id,
    label: group.latest.subject?.trim() || '(无主题)',
  }))
}

const {
  navigation,
  loading: navigationLoading,
  direction: navigationDirection,
  navigate: handleSheetNavigate,
  load: reloadNavigation,
} = useSheetNavigation(
  selectedGroupId,
  loadMailNavigationItems,
  (targetId: string) => {
    const group = visibleConversations.value.find(g => g.id === targetId)
    if (group) {
      void openConversation(group)
    }
  },
  isReaderOpen,
)

watch(visibleConversations, () => {
  void reloadNavigation()
})

function handleCloseReader() {
  clearReader()
  mobilePane.value = 'list'
}

async function archiveAndAdvance() {
  if (!readerMessages.value.length || actionBusy.value) return
  const currentIds = readerMessages.value.map(row => row.id)
  const nextTargetId = navigation.value.next?.id || navigation.value.previous?.id || null
  const nextGroup = nextTargetId ? visibleConversations.value.find(g => g.id === nextTargetId) || null : null

  await performAction('archive', currentIds)
  if (nextGroup) {
    void openConversation(nextGroup)
  } else {
    handleCloseReader()
  }
}

async function trashAndAdvance() {
  if (!readerMessages.value.length || actionBusy.value) return
  const currentIds = readerMessages.value.map(row => row.id)
  const nextTargetId = navigation.value.next?.id || navigation.value.previous?.id || null
  const nextGroup = nextTargetId ? visibleConversations.value.find(g => g.id === nextTargetId) || null : null

  await performAction('trash', currentIds)
  if (nextGroup) {
    void openConversation(nextGroup)
  } else {
    handleCloseReader()
  }
}
const allVisibleSelected=computed(()=>visibleConversations.value.length>0 && visibleConversations.value.every(group=>group.messages.every(m=>selection.value.has(m.id))))
function selectVisibleAll(){
  const next=new Set(selection.value)
  if(allVisibleSelected.value){
    for(const group of visibleConversations.value)for(const m of group.messages)next.delete(m.id)
  }else{
    for(const group of visibleConversations.value)for(const m of group.messages)if(next.size<100)next.add(m.id)
  }
  selection.value=next
}
function clearSelection(){
  selection.value = new Set()
}
let organizerVersion=0
async function loadOrganizer(){
  const version=++organizerVersion
  try {
    const next=await fetchMailOrganizer()
    if(version!==organizerVersion)return
    organizerState.value=next
    organizerError.value=''
  } catch {
    if(version===organizerVersion)organizerError.value='提醒和标签未能加载，收件箱仍可正常使用。'
  }
}
function openMailOrganizer(target?:MailSummary) {
  organizerTarget.value=target || null
  organizerOpen.value=true
  if(mailIsActive.value)void loadOrganizer()
}
async function onOrganizerAction(input:MailOrganizerMutation){
  if(organizerBusy.value)return
  organizerBusy.value=true;organizerError.value='';organizerVersion++
  try {
    const updated=await mutateMailOrganizer(input)
    const rows=organizerState.value.records.filter(x=>x.message_id!==updated.message_id)
    organizerState.value={...organizerState.value,records:[updated,...rows]}
    if(input.action==='snooze') selection.value=new Set()
    notice.value='提醒和标签已保存。'
  }catch {
    organizerError.value='操作未保存，请刷新邮件后重试。'
  }finally{organizerBusy.value=false}
}
async function onCreateOrganizerLabel(input:{name:string;color:MailOrganizerColor}){
  if(organizerBusy.value)return
  organizerBusy.value=true;organizerError.value='';organizerVersion++
  try{
    const label=await createMailOrganizerLabel(input.name,input.color)
    organizerState.value={...organizerState.value,labels:[...organizerState.value.labels,label]}
  }catch{
    organizerError.value='标签未能创建，可能是名称重复或达到数量限制。'
  }finally{organizerBusy.value=false}
}
async function onUpdateOrganizerLabel(input:import('@/api/mailClient').MailOrganizerLabel){
  if(organizerBusy.value)return
  organizerBusy.value=true;organizerError.value='';organizerVersion++
  try{
    const label=await updateMailOrganizerLabel(input)
    organizerState.value={...organizerState.value,labels:organizerState.value.labels.map(old=>old.id===label.id?label:old)}
  }catch{organizerError.value='标签修改未保存，请检查名称和其他设备上的修改。'}
  finally{organizerBusy.value=false}
}
async function onDeleteOrganizerLabel(id:string){
  if(organizerBusy.value)return
  organizerBusy.value=true;organizerError.value='';organizerVersion++
  try{
    await deleteMailOrganizerLabel(id)
    if(organizerFilterId.value===id)organizerFilterId.value=''
    organizerState.value={
      labels:organizerState.value.labels.filter(item=>item.id!==id),
      records:organizerState.value.records.map(row=>({...row,label_ids:row.label_ids.filter(v=>v!==id)}))
    }
  }catch{
    organizerError.value='标签未能删除，请刷新后重试。'
  }finally{organizerBusy.value=false}
}
let organizerTick:ReturnType<typeof setInterval>|undefined
watch(mailIsActive, active=>{
  if(active)void loadOrganizer()
  else{organizerVersion++;organizerState.value={labels:[],records:[]}}
},{immediate:true})
onMounted(()=>{organizerTick=setInterval(()=>{organizerNow.value=Date.now()},30000)})
onBeforeUnmount(()=>{organizerVersion++;clearInterval(organizerTick)})

async function openNativeFromAggregate(id:string){
  externalOpen.value=false
  const inbox=folders.value.find(row=>row.role==='inbox')
  if(!inbox)return
  if(currentFolderId.value!==inbox.id) await selectFolder(inbox.id)
  else if(!messages.value.some(row=>row.id===id)) await loadMessages()
  const group=conversations.value.find(row=>row.messages.some(message=>message.id===id))
  if(group) await openConversation(group)
  else {mobilePane.value='list';notice.value='已切换至 Atoman 收件箱，目标邮件可能不在当前页。'}
}
// The mailbox owns its shortcuts only while it is visible. Never intercept
// composing, dialogs, keyboard IME, or other forms.
function handleMailShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
  const element = event.target instanceof Element ? event.target : null
  // Do not intercept standard form inputs
  if (element?.closest('input,textarea,select,[contenteditable="true"]')) {
    if (event.key === 'Escape' && shortcutHelp.value) {
      shortcutHelp.value = false
      event.preventDefault()
    }
    return
  }
  // If external modals/dialogs (excluding our reader sheet) are active, do not intercept
  if (element?.closest('[role="dialog"]') && !element?.closest('.mail-workspace__reader-sheet')) {
    if (event.key === 'Escape' && shortcutHelp.value) {
      shortcutHelp.value = false
      event.preventDefault()
    }
    return
  }
  if (composeDraft.value || settingsOpen.value || externalOpen.value || organizerOpen.value || advancedOpen.value || attachmentPreview.value || folderDialog.value || deleteFolderDialog.value) return

  const key = event.key.toLowerCase()

  // 1. Shortcut help toggle (?)
  if (event.key === '?') {
    shortcutHelp.value = !shortcutHelp.value
    event.preventDefault()
    return
  }
  if (shortcutHelp.value) {
    if (event.key === 'Escape') shortcutHelp.value = false
    return
  }

  // 2. Compose (C)
  if (key === 'c') {
    newMessage()
    event.preventDefault()
    return
  }

  // 3. Search focus (/)
  if (key === '/') {
    if (isDraftFolder.value) return
    const input = document.querySelector<HTMLInputElement>('.mail-workspace__search input')
    if (input) {
      input.focus()
      event.preventDefault()
    }
    return
  }

  // 4. Escape: Close reader sheet or go back to folders on mobile
  if (event.key === 'Escape') {
    if (selectedGroupId.value || mobilePane.value === 'reader') {
      handleCloseReader()
      event.preventDefault()
    } else if (mobilePane.value === 'list') {
      mobilePane.value = 'folders'
      event.preventDefault()
    }
    return
  }

  // 5. Navigation: J (next) / K (previous)
  if (key === 'j' || key === 'k') {
    if (isDraftFolder.value) return
    const direction: SheetNavigationDirection = key === 'j' ? 'next' : 'previous'
    if (selectedGroupId.value) {
      if (handleSheetNavigate(direction)) {
        event.preventDefault()
      }
    } else {
      const groups = visibleConversations.value
      if (groups.length) {
        void openConversation(groups[0]!)
        event.preventDefault()
      }
    }
    return
  }

  // 6. Enter / O: Open selected conversation when reader is closed
  if ((event.key === 'Enter' || key === 'o') && !selectedGroupId.value) {
    const groups = visibleConversations.value
    if (groups.length && !isDraftFolder.value) {
      void openConversation(groups[0]!)
      event.preventDefault()
    }
    return
  }

  // 7. Actions inside open reader
  if (!readerMessages.value.length || actionBusy.value) return
  const current = readerMessages.value[readerMessages.value.length - 1]
  if (!current) return

  // E: Archive and advance to next
  if (key === 'e') {
    void archiveAndAdvance()
    event.preventDefault()
    return
  }

  // # or Delete: Trash and advance
  if (event.key === '#' || event.key === 'Delete') {
    void trashAndAdvance()
    event.preventDefault()
    return
  }

  // S: Toggle Star
  if (key === 's') {
    void performAction(current.isFlagged ? 'unflag' : 'flag', [current.id])
    event.preventDefault()
    return
  }

  // U: Mark unread and close reader
  if (key === 'u') {
    void performAction('unread', [current.id])
    handleCloseReader()
    event.preventDefault()
    return
  }

  // R: Reply (single)
  if (key === 'r' && !event.shiftKey && details.value[current.id]) {
    replyTo(details.value[current.id]!, false)
    event.preventDefault()
    return
  }

  // A or Shift+R: Reply All
  if ((key === 'a' || (key === 'r' && event.shiftKey)) && details.value[current.id]) {
    replyTo(details.value[current.id]!, true)
    event.preventDefault()
    return
  }

  // F: Forward
  if (key === 'f' && details.value[current.id]) {
    forwardMessage(details.value[current.id]!)
    event.preventDefault()
    return
  }
}
// Mobile swipe back gesture for touch devices
let touchStartX = 0
let touchStartY = 0
let touchStartTime = 0

function handleTouchStart(e: TouchEvent) {
 if (e.touches.length !== 1) return
 const touch = e.touches[0]
 if (!touch) return
 touchStartX = touch.clientX
 touchStartY = touch.clientY
 touchStartTime = Date.now()
}

function handleTouchEnd(e: TouchEvent) {
 if (typeof window !== 'undefined' && window.innerWidth > 950) return
 if (e.changedTouches.length !== 1) return
 const touch = e.changedTouches[0]
 if (!touch) return
 const deltaX = touch.clientX - touchStartX
 const deltaY = touch.clientY - touchStartY
 const duration = Date.now() - touchStartTime

 // Trigger edge right-swipe back (from left side with dominant horizontal travel)
 if (duration < 400 && deltaX > 60 && Math.abs(deltaY) < 50 && touchStartX < 120) {
  if (mobilePane.value === 'reader' || selectedGroupId.value) {
   handleCloseReader()
  } else if (mobilePane.value === 'list') {
   mobilePane.value = 'folders'
  }
 }
}

onMounted(() => {
 viewport = window.matchMedia?.('(max-width: 767px)')
 syncViewport()
 viewport?.addEventListener('change', syncViewport)
 document.addEventListener('keydown', handleMailShortcut)
 document.addEventListener('touchstart', handleTouchStart, { passive: true })
 document.addEventListener('touchend', handleTouchEnd, { passive: true })
})
onBeforeUnmount(() => {
 viewport?.removeEventListener('change', syncViewport)
 document.removeEventListener('keydown', handleMailShortcut)
 document.removeEventListener('touchstart', handleTouchStart)
 document.removeEventListener('touchend', handleTouchEnd)
})
const attachmentPreview=ref<{messageId:string;attachment:MailAttachmentInfo}|null>(null)
function previewAttachment(message:MailSummary,attachment:MailAttachmentInfo){
 attachmentPreview.value={messageId:message.id,attachment}
}
const folderIcon = (role: string | null) => ({ inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2, junk: ShieldAlert, archive: Archive }[role || ''] || Folder)
</script>
<style src="./mail-workspace.css"></style>
