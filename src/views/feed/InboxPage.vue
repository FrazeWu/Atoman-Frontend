<template>
  <div class="a-page-xl inbox-page">
    <div class="a-section-header inbox-header">
      <div>
        <h1 class="a-title">通知</h1>
        <p class="a-muted">查看互动、协作提醒和私信。</p>
      </div>
      <PButton v-if="activeTab !== 'dm'" variant="secondary" @click="markCurrentNotificationsRead" label="标为已读" />
    </div>

    <div class="inbox-shell">
      <div class="inbox-body">
        <!-- Left Category Pane (220px fixed) -->
        <aside class="inbox-category-pane" aria-label="通知分类">
          <nav class="inbox-category-list">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="inbox-category-item"
              :class="{ active: activeTab === tab.key }"
              :aria-pressed="activeTab === tab.key"
              @click="switchTab(tab.key)"
            >
              <span class="category-item-label">{{ tab.label }}</span>
              <span v-if="tabUnreadCount(tab.key) > 0" class="tab-count">{{ tabUnreadCount(tab.key) }}</span>
            </button>
          </nav>
        </aside>

        <!-- Right Main Pane -->
        <main class="inbox-main-pane" aria-label="通知内容">
          <!-- Notification Stream Mode -->
          <div v-if="activeTab !== 'dm'" class="stream-workspace">
            <!-- Stream Toolbar -->
            <div class="stream-toolbar">
              <div class="stream-toolbar-inner">
                <div class="stream-toolbar-left">
                  <h2 class="stream-title">{{ activeTabLabel }}</h2>
                  <span v-if="activeCategoryUnreadCount > 0" class="stream-count-badge">
                    {{ activeCategoryUnreadCount }}
                  </span>
                </div>
                <div class="stream-toolbar-right">
                  <div class="stream-filter-toggle" role="group" aria-label="通知过滤">
                    <button
                      type="button"
                      class="filter-toggle-btn"
                      :class="{ active: filterMode === 'all' }"
                      @click="filterMode = 'all'"
                    >
                      所有
                    </button>
                    <button
                      type="button"
                      class="filter-toggle-btn"
                      :class="{ active: filterMode === 'unread' }"
                      @click="filterMode = 'unread'"
                    >
                      仅未读
                    </button>
                  </div>
                  <PButton
                    v-if="activeCategoryUnreadCount > 0"
                    variant="ghost"
                    size="sm"
                    class="toolbar-mark-read-btn"
                    @click="markCurrentNotificationsRead"
                  >
                    标为已读
                  </PButton>
                </div>
              </div>
            </div>

            <!-- Constrained Stream Container -->
            <div class="stream-workspace-container">
              <!-- Notification Feed Stream Cards -->
              <div class="stream-list sidebar-list">
                <NotificationItemCard
                  v-for="item in filteredNotifications"
                  :key="item.id"
                  :notification="item"
                  :active="selectedNotificationId === item.id"
                  @click="openNotification(item.id)"
                  @jump="jumpToNotification"
                  @mark-read="notificationStore.markRead(item.id)"
                  @mute-type="handleMuteType(item)"
                  @mute-source="handleMuteSource(item)"
                />
                <p v-if="notificationActionMessage" class="action-message a-muted">
                  {{ notificationActionMessage }}
                </p>
              </div>

              <!-- Empty State -->
              <div v-if="!notificationStore.loading && filteredNotifications.length === 0" class="inbox-empty-state">
                <strong>暂无通知</strong>
                <span>{{ filterMode === 'unread' ? '当前分类没有未读通知。' : '当前分类没有新内容。' }}</span>
              </div>
            </div>
          </div>

          <!-- DM Mode -->
          <div v-else class="dm-workspace">
            <div class="dm-workspace-sidebar" :class="{ 'dm-workspace-sidebar--hidden': mobileConversationOpen }">
              <div class="pane-heading">
                <span>私信</span>
                <PButton variant="secondary" @click="dmStore.fetchConversations" label="刷新" />
              </div>
              <DMMailboxSelector :mailboxes="dmMailboxes" :active-mailbox-key="dmStore.activeMailboxKey" @select-mailbox="selectMailbox" />
              <DMConversationList :conversations="dmConversations" :active-conversation-id="dmStore.activeConversationId" :loading="dmStore.loadingConversations" :has-more="hasMoreConversations" @open-conversation="openConversation" @load-more="dmStore.loadMoreConversations" />
            </div>

            <section class="dm-workspace-main inbox-detail">
              <div v-if="!mobileConversationOpen && (dmStore.activeConversation || dmStore.activeTarget)" class="detail-card detail-card-dm">
                <DMConversationPane :conversation="dmStore.activeConversation" :messages="dmStore.activeMessages" :has-more="dmStore.canLoadOlderMessages" :loading="dmStore.loadingMessages" :mobile="isMobile" :target-label="dmStore.activeTarget?.display_name || '新会话'" @back="closeMobileConversation" @load-older="dmStore.loadOlderMessages" @block="blockActiveConversation" @unblock="unblockActiveConversation" @report="reportMessageId = $event">
                  <DMComposer v-model="dmContent" :disabled="dmStore.activeConversationBlocked" :sending="dmSending" :reply-as-label="dmStore.replyAsLabel" :error="dmError" :image="dmImage" @send="submitDM" @upload-image="uploadDMImage" @remove-image="dmImage = null" />
                </DMConversationPane>
              </div>
              <div v-else class="detail-empty">
                <strong>{{ dmOpenError ? '无法打开会话' : '选择一个会话' }}</strong>
                <span>{{ dmOpenError || '点击左侧私信会话开始聊天。' }}</span>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    <!-- Mobile Conversation Bottom Sheet -->
    <PSheet
      v-if="mobileConversationOpen"
      :show="mobileConversationOpen"
      side="bottom"
      :title="mobileConversationTitle"
      close-type="header"
      :height="'calc(100dvh - var(--a-content-bottom-offset))'"
      panel-class="inbox-mobile-conversation-sheet"
      @close="closeMobileConversation"
    >
      <DMConversationPane :conversation="dmStore.activeConversation" :messages="dmStore.activeMessages" :has-more="dmStore.canLoadOlderMessages" :loading="dmStore.loadingMessages" :mobile="isMobile" :target-label="dmStore.activeTarget?.display_name || '新会话'" @back="closeMobileConversation" @load-older="dmStore.loadOlderMessages" @block="blockActiveConversation" @unblock="unblockActiveConversation" @report="reportMessageId = $event">
        <DMComposer v-model="dmContent" :disabled="dmStore.activeConversationBlocked" :sending="dmSending" :reply-as-label="dmStore.replyAsLabel" :error="dmError" :image="dmImage" @send="submitDM" @upload-image="uploadDMImage" @remove-image="dmImage = null" />
      </DMConversationPane>
    </PSheet>

    <!-- DM Report Modal -->
    <DMReportModal :open="Boolean(reportMessageId)" :message-id="reportMessageId" :submitting="reportSubmitting" :error="reportError" above-player @close="closeReportModal" @clear-error="reportError = ''" @report="reportMessage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import NotificationItemCard from '@/components/notification/NotificationItemCard.vue'
import DMMailboxSelector from '@/components/dm/DMMailboxSelector.vue'
import DMConversationList from '@/components/dm/DMConversationList.vue'
import DMConversationPane from '@/components/dm/DMConversationPane.vue'
import DMComposer from '@/components/dm/DMComposer.vue'
import DMReportModal from '@/components/dm/DMReportModal.vue'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'
import { useAuthStore } from '@/stores/auth'
import type { InboxTab, Notification, NotificationCategory } from '@/types'
import { dmErrorMessage, type DMImage } from '@/api/dm'
import { notificationTargetPath } from '@/utils/notificationHelpers'

type InboxPageTab = InboxTab | 'forum'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const inboxStore = useInboxStore()
const notificationStore = useNotificationStore()
const dmStore = useDMStore()

const tabs: Array<{ key: InboxPageTab; label: string }> = [
  { key: 'like', label: '点赞' },
  { key: 'interaction', label: '互动' },
  { key: 'mention', label: '@我' },
  { key: 'reply', label: '回复我' },
  { key: 'forum', label: '论坛' },
  { key: 'collaboration', label: '协作' },
  { key: 'system', label: '通知' },
  { key: 'dm', label: '私信' },
]

const forumNotificationTypes: Notification['type'][] = ['forum_topic_comment', 'forum_follow']

const selectedNotificationId = ref<string | null>(null)
const filterMode = ref<'all' | 'unread'>('all')
const notificationActionMessage = ref('')

const dmContent = ref('')
const dmImage = ref<DMImage | null>(null)
const dmSending = ref(false)
const dmError = ref('')
const dmOpenError = ref('')
const reportMessageId = ref('')
const reportSubmitting = ref(false)
const reportError = ref('')

const viewportMatchesMobile = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
const isMobile = ref(viewportMatchesMobile())
const updateViewport = () => { isMobile.value = viewportMatchesMobile() }
const mobileConversationOpen = computed(() => isMobile.value && Boolean(dmStore.activeConversation || dmStore.activeTarget))
const mobileConversationTitle = computed(() => {
  const name = dmStore.activeConversation?.other_party.display_name || dmStore.activeTarget?.display_name || '新会话'
  return `私信-${name}`
})

const dmMailboxes = computed(() => dmStore.mailboxOrder.map(key => dmStore.mailboxesByKey[key]).filter(Boolean))
const dmConversations = computed(() => dmStore.conversationIdsByMailbox[dmStore.activeMailboxKey]?.map(id => dmStore.conversationsById[id]).filter(Boolean) || [])
const hasMoreConversations = computed(() => Boolean(dmStore.conversationCursorByMailbox[dmStore.activeMailboxKey]))

const activeTab = computed<InboxPageTab>(() => {
  const tab = route.query.tab
  if (tab === 'like' || tab === 'interaction' || tab === 'mention' || tab === 'reply' || tab === 'forum' || tab === 'collaboration' || tab === 'system' || tab === 'dm') return tab
  const firstUnread = tabs.find((item) => item.key !== 'forum' && notificationStore.unreadCounts[item.key] > 0)
  return firstUnread?.key || 'mention'
})

const activeTabLabel = computed(() => tabs.find((item) => item.key === activeTab.value)?.label || '通知')
const tabUnreadCount = (tab: InboxPageTab) => tab === 'forum' ? 0 : notificationStore.unreadCounts[tab] || 0
const activeCategoryUnreadCount = computed(() => tabUnreadCount(activeTab.value))

const filteredNotifications = computed(() => {
  if (filterMode.value === 'unread') {
    return notificationStore.notifications.filter((item) => !item.read_at)
  }
  return notificationStore.notifications
})


const switchTab = async (tab: InboxPageTab) => {
  filterMode.value = 'all'
  await router.push({ path: '/inbox', query: { tab } })
}

const loadTab = async () => {
  if (activeTab.value === 'dm') {
    dmOpenError.value = ''
    try { await dmStore.bootstrapDM() } catch { /* 会话直链仍可继续打开 */ }
    const mailbox = typeof route.query.mailbox === 'string' ? route.query.mailbox : ''
    if (mailbox && dmStore.mailboxesByKey[mailbox]) await dmStore.selectMailbox(mailbox)
    const targetType = route.query.target_type === 'user' || route.query.target_type === 'channel' ? route.query.target_type : ''
    const targetID = typeof route.query.target_id === 'string' ? route.query.target_id : ''
    const conversationID = typeof route.query.conversation === 'string' ? route.query.conversation : ''
    const user = typeof route.query.user === 'string' ? route.query.user : ''
    if (targetType && targetID) {
      try {
        await dmStore.openTarget({ type: targetType, id: targetID })
      } catch (error) {
        dmOpenError.value = error instanceof Error ? error.message : '打开私信失败'
      }
    } else if (user) {
      try {
        await dmStore.openConversation(user)
      } catch (error) {
        dmOpenError.value = error instanceof Error ? error.message : '打开私信失败'
      }
    } else if (conversationID) {
      try {
        await dmStore.openConversation(conversationID)
      } catch (error) {
        dmOpenError.value = error instanceof Error ? error.message : '打开私信失败'
      }
    }
    return
  }

  await notificationStore.fetchNotifications(activeTab.value === 'forum' ? forumNotificationTypes : activeTab.value as NotificationCategory, 1)
  selectedNotificationId.value = notificationStore.notifications[0]?.id || null
}

const openNotification = async (id: string) => {
  selectedNotificationId.value = id
  await notificationStore.markRead(id)
}

const markCurrentNotificationsRead = async () => {
  if (activeTab.value === 'dm') return
  await notificationStore.markAllRead(activeTab.value === 'forum' ? forumNotificationTypes : activeTab.value as NotificationCategory)
}

const jumpToNotification = async (notification: Notification) => {
  await notificationStore.markRead(notification.id)
  const targetPath = notificationTargetPath(notification)
  if (!targetPath) return
  await router.push(targetPath)
}

const muteNotificationType = async (notification: Notification) => {
  notificationActionMessage.value = (await notificationStore.savePreference(notification.category, notification.type, false))
    ? ''
    : '通知偏好暂不可用'
}

const handleMuteType = async (notification: Notification, event: Event) => {
  (event.target as HTMLElement).closest('details')?.removeAttribute('open')
  await muteNotificationType(notification)
}

const muteNotificationSource = async (notification: Notification) => {
  notificationActionMessage.value = (await notificationStore.createMute(notification.source_type, notification.source_id, notification.reason))
    ? ''
    : '内容静音暂不可用'
}

const handleMuteSource = async (notification: Notification, event: Event) => {
  (event.target as HTMLElement).closest('details')?.removeAttribute('open')
  await muteNotificationSource(notification)
}

const openConversation = async (conversationID: string) => {
  dmOpenError.value = ''
  await router.replace({ path: '/inbox', query: { tab: 'dm', mailbox: dmStore.activeMailboxKey, conversation: conversationID } })
  await dmStore.openConversation(conversationID)
}

const selectMailbox = async (key: string) => {
  await router.replace({ path: '/inbox', query: { tab: 'dm', mailbox: key } })
  await dmStore.selectMailbox(key)
}

const closeMobileConversation = async () => {
  await router.replace({ path: '/inbox', query: { tab: 'dm', mailbox: dmStore.activeMailboxKey } })
  dmStore.activeConversationId = ''
  dmStore.activeTarget = null
}

const submitDM = async (payload: { content: string; imageId?: string }) => {
  if ((!dmStore.activeConversation && !dmStore.activeTarget) || (!payload.content && !payload.imageId)) return
  dmSending.value = true
  dmError.value = ''
  try {
    const message = await dmStore.sendActiveMessage(payload.content, payload.imageId)
    dmContent.value = ''
    dmImage.value = null
    if (dmStore.activeConversationId) await router.replace({ path: '/inbox', query: { tab: 'dm', mailbox: dmStore.activeMailboxKey, conversation: message.conversation_id } })
  } catch (error) {
    dmError.value = dmErrorMessage(error)
  } finally {
    dmSending.value = false
  }
}

const uploadDMImage = async (file: File) => {
  try {
    dmImage.value = await dmStore.uploadImage(file)
  } catch (error) {
    dmError.value = dmErrorMessage(error)
  }
}

const reportMessage = async ({ messageId, reason, detail }: { messageId: string; reason: string; detail: string }) => {
  if (reportSubmitting.value) return
  reportSubmitting.value = true
  reportError.value = ''
  try { await dmStore.reportMessage(messageId, { reason, detail }); closeReportModal() } catch (error) { reportError.value = dmErrorMessage(error) } finally { reportSubmitting.value = false }
}

const closeReportModal = () => { reportMessageId.value = ''; reportError.value = '' }

const blockActiveConversation = async () => {
  await dmStore.blockActiveConversation()
}

const unblockActiveConversation = async () => {
  await dmStore.unblockActiveConversation()
}

watch(() => route.fullPath, () => {
  loadTab()
})

onMounted(async () => {
  window.addEventListener('resize', updateViewport)
  await inboxStore.bootstrap()
  await loadTab()
})

onBeforeUnmount(() => window.removeEventListener('resize', updateViewport))
</script>

<style scoped>
.inbox-header {
  align-items: flex-end;
  gap: 1rem;
}

.inbox-page {
  max-width: 92rem;
}

.inbox-shell {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  min-height: 38rem;
}

.inbox-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 38rem;
}

.inbox-category-pane {
  min-width: 0;
  width: 220px;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  display: flex;
  flex-direction: column;
}

.inbox-category-list {
  display: flex;
  flex-direction: column;
}

.inbox-category-item {
  width: 100%;
  min-height: 3.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 1.25rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.inbox-category-item:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.inbox-category-item.active {
  border-left-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: 600;
}

.inbox-category-item:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
}

.tab-count {
  min-width: 1.25rem;
  height: 1.25rem;
  display: grid;
  place-items: center;
  padding: 0 0.35rem;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-radius: var(--a-radius-control);
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1;
}

.inbox-main-pane {
  min-width: 0;
  background: var(--a-color-bg);
  display: flex;
  flex-direction: column;
}

/* Notification Stream Workspace */
.stream-workspace {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.stream-toolbar {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.stream-toolbar-inner {
  width: 100%;
  max-width: 780px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.stream-workspace-container {
  width: 100%;
  max-width: 780px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stream-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stream-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--a-color-text);
}

.stream-count-badge {
  min-width: 1.25rem;
  height: 1.25rem;
  display: inline-grid;
  place-items: center;
  padding: 0 0.35rem;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-primary) 12%, transparent);
  color: var(--a-color-primary);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
}

.stream-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stream-filter-toggle {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  padding: 2px;
}

.filter-toggle-btn {
  padding: 0.25rem 0.625rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.filter-toggle-btn:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.filter-toggle-btn.active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

.stream-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stream-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  background: var(--a-color-bg);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.stream-card:hover {
  background: var(--a-color-surface-muted);
}

.stream-card.selected {
  border-left-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.stream-card.unread .card-title {
  font-weight: 600;
  color: var(--a-color-text);
}

.card-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
}

.card-action-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--a-color-bg, #ffffff);
  border: 1.5px solid var(--a-color-bg, #ffffff);
}

.card-action-badge--like {
  color: var(--a-color-danger, #ef4444);
}

.card-action-badge--reply,
.card-action-badge--forum {
  color: var(--a-color-primary, #2563eb);
}

.card-action-badge--mention {
  color: var(--a-color-success, #10b981);
}

.card-action-badge--collaboration {
  color: var(--a-color-warning, #f59e0b);
}

.card-action-badge--system {
  color: var(--a-color-blog, #166534);
}

.card-content-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.card-title-group {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

.card-title {
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--a-color-text);
}

.card-separator {
  color: var(--a-color-text-muted);
}

.card-source {
  font-size: 0.8rem;
  color: var(--a-color-text-secondary);
  font-weight: 500;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.card-time {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  font-weight: 500;
  white-space: nowrap;
}

.card-unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-primary, #2563eb);
  flex-shrink: 0;
}

.card-reason {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.card-quote {
  margin-top: 0.125rem;
}

.sidebar-item-body {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary);
}

.card-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.card-actions-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-actions-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.card-action-unavailable-btn {
  font-size: 0.75rem;
}

.card-more-menu {
  position: relative;
}

.card-more-trigger {
  list-style: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.card-more-trigger::-webkit-details-marker {
  display: none;
}

.card-more-trigger:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.card-menu-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  min-width: 140px;
  padding: 0.25rem 0;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  box-shadow: var(--a-shadow-lg);
  z-index: 10;
}

.card-menu-item {
  display: block;
  width: 100%;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: left;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
}

.card-menu-item:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.action-message {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
}

.inbox-empty-state {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.4rem;
  min-height: 12rem;
  padding: 2rem 1.5rem;
  color: var(--a-color-text-secondary);
}

.inbox-empty-state strong {
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 500;
}

.inbox-empty-state span {
  font-size: 0.9rem;
}

/* DM Workspace */
.dm-workspace {
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  min-height: 38rem;
  height: 100%;
}

.dm-workspace-sidebar {
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  display: flex;
  flex-direction: column;
}

.pane-heading {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  font-size: 0.8rem;
  font-weight: 500;
}

.dm-workspace-main {
  min-width: 0;
  background: var(--a-color-bg);
  display: flex;
  flex-direction: column;
}

.detail-card-dm {
  min-height: 32rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
  height: 100%;
}

.detail-empty {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.4rem;
  min-height: 100%;
  padding: 2rem;
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
}

.detail-empty strong {
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 500;
}

.detail-empty span {
  font-size: 0.9rem;
}

@media (max-width: 960px) {
  .inbox-body {
    grid-template-columns: 1fr;
  }

  .inbox-category-pane {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--a-color-border-soft);
  }

  .inbox-category-list {
    display: flex;
    overflow-x: auto;
  }

  .inbox-category-item {
    min-width: 5.5rem;
    justify-content: center;
    border-left: none;
    border-bottom: 3px solid transparent;
  }

  .inbox-category-item.active {
    border-bottom-color: var(--a-color-text);
  }

  .dm-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .dm-workspace-sidebar--hidden {
    display: none;
  }
}

:global(.inbox-mobile-conversation-sheet .sheet-content) {
  min-height: 0;
  padding: 0;
}

:global(.inbox-mobile-conversation-sheet .dm-conversation-pane) {
  height: 100%;
}
</style>
