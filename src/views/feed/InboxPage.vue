<template>
  <div class="a-page-xl inbox-page">
    <div class="a-section-header inbox-header">
      <div>
        <h1 class="a-title">通知</h1>
        <p class="a-muted">查看互动、协作提醒和私信。</p>
      </div>
      <PPress v-if="activeTab !== 'dm'" variant="secondary" @click="markCurrentNotificationsRead" label="标为已读" />
    </div>

    <div class="inbox-shell">
      <div class="inbox-body">
        <aside class="inbox-category-pane" aria-label="通知分类">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="inbox-category-item"
            :class="{ active: activeTab === tab.key }"
            :aria-pressed="activeTab === tab.key"
            @click="switchTab(tab.key)"
          >
            <span>{{ tab.label }}</span>
            <span v-if="tabUnreadCount(tab.key) > 0" class="tab-count">{{ tabUnreadCount(tab.key) }}</span>
          </button>
        </aside>

        <div class="inbox-list-pane">
          <div class="pane-heading">
            <span>{{ activeTabLabel }}</span>
            <PPress v-if="activeTab === 'dm'" variant="secondary" @click="dmStore.fetchConversations" label="刷新" />
          </div>

          <div v-if="activeTab !== 'dm'" class="sidebar-list">
            <button
              v-for="item in notificationStore.notifications"
              :key="item.id"
              class="sidebar-item"
              :class="{ unread: !item.read_at, selected: selectedNotificationId === item.id }"
              @click="openNotification(item.id)"
            >
              <div class="sidebar-item-title">{{ formatNotificationTitle(item) }}</div>
              <div v-if="notificationSourceLabel(item)" class="sidebar-item-source">{{ notificationSourceLabel(item) }}</div>
              <div class="sidebar-item-body a-muted">{{ formatNotificationBody(item) }}</div>
              <div class="sidebar-item-time">{{ formatTime(item.created_at) }}</div>
            </button>
            <div v-if="!notificationStore.loading && notificationStore.notifications.length === 0" class="inbox-empty-state">
              <strong>暂无通知</strong>
              <span>当前分类没有新内容。</span>
            </div>
          </div>

          <div v-else class="dm-list-workspace" :class="{ 'dm-list-workspace--hidden': mobileConversationOpen }">
            <DMMailboxSelector :mailboxes="dmMailboxes" :active-mailbox-key="dmStore.activeMailboxKey" @select-mailbox="selectMailbox" />
            <DMConversationList :conversations="dmConversations" :active-conversation-id="dmStore.activeConversationId" :loading="dmStore.loadingConversations" :has-more="hasMoreConversations" @open-conversation="openConversation" @load-more="dmStore.loadMoreConversations" />
          </div>
        </div>

        <section class="inbox-detail">
          <template v-if="activeTab !== 'dm'">
            <div v-if="selectedNotification" class="detail-card">
              <h2 class="a-subtitle">{{ formatNotificationTitle(selectedNotification) }}</h2>
              <p class="detail-body a-muted">{{ formatNotificationBody(selectedNotification) }}</p>
              <p class="detail-reason">{{ selectedNotification.reason }}</p>
              <p class="detail-source">{{ notificationSourceLabel(selectedNotification) || '来源已不可用' }}</p>
              <p class="detail-time">{{ formatTime(selectedNotification.created_at) }}</p>
              <div class="detail-actions">
                <PButton v-if="notificationTargetPath(selectedNotification)" @click="jumpToNotification(selectedNotification)">前往来源内容</PButton>
                <PButton v-else variant="secondary" disabled>来源已不可用</PButton>
                <PButton variant="secondary" @click="notificationStore.markRead(selectedNotification.id)">标记已读</PButton>
                <PButton variant="secondary" @click="muteNotificationType(selectedNotification)">不再提醒此类</PButton>
                <PButton variant="secondary" @click="muteNotificationSource(selectedNotification)">不再提醒此内容</PButton>
              </div>
              <p v-if="notificationActionMessage" class="a-muted">{{ notificationActionMessage }}</p>
            </div>
            <div v-else class="detail-empty">
              <strong>选择一条通知</strong>
              <span>点击左侧通知查看详情。</span>
            </div>
          </template>

          <template v-else>
            <div v-if="dmStore.activeConversation || dmStore.activeTarget" class="detail-card detail-card-dm" :class="{ 'detail-card-dm--mobile': mobileConversationOpen }">
              <DMConversationPane :conversation="dmStore.activeConversation" :messages="dmStore.activeMessages" :has-more="dmStore.canLoadOlderMessages" :loading="dmStore.loadingMessages" :mobile="isMobile" :target-label="dmStore.activeTarget?.id" @back="closeMobileConversation" @load-older="dmStore.loadOlderMessages" @block="blockActiveConversation" @unblock="unblockActiveConversation" @report="reportMessageId = $event">
                <DMComposer v-model="dmContent" :disabled="dmStore.activeConversationBlocked" :sending="dmSending" :reply-as-label="dmStore.replyAsLabel" :error="dmError" :image="dmImage" @send="submitDM" @upload-image="uploadDMImage" @remove-image="dmImage = null" />
              </DMConversationPane>
            </div>
            <div v-else class="detail-empty">
              <strong>{{ dmOpenError ? '无法打开会话' : '选择一个会话' }}</strong>
              <span>{{ dmOpenError || '点击左侧私信会话开始聊天。' }}</span>
            </div>
          </template>
        </section>
      </div>
    </div>
    <DMReportModal :open="Boolean(reportMessageId)" :message-id="reportMessageId" :submitting="reportSubmitting" :error="reportError" @close="closeReportModal" @clear-error="reportError = ''" @report="reportMessage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import { useInboxStore } from '@/stores/inbox'
import { commentNotificationLocation, contentPublishedLocation, forumNotificationLocation, isCommentNotification, useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'
import { useAuthStore } from '@/stores/auth'
import { referenceHref } from '@/composables/useReferenceRendering'
import type { InboxTab, Notification, NotificationCategory } from '@/types'
import { dmErrorMessage, mailboxKey, type DMImage } from '@/api/dm'
import DMMailboxSelector from '@/components/dm/DMMailboxSelector.vue'
import DMConversationList from '@/components/dm/DMConversationList.vue'
import DMConversationPane from '@/components/dm/DMConversationPane.vue'
import DMComposer from '@/components/dm/DMComposer.vue'
import DMReportModal from '@/components/dm/DMReportModal.vue'
import type { RouteLocationRaw } from 'vue-router'

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
  { key: 'system', label: '系统' },
  { key: 'dm', label: '私信' },
]

const selectedNotificationId = ref<string | null>(null)
const dmContent = ref('')
const dmImage = ref<DMImage | null>(null)
const dmSending = ref(false)
const dmError = ref('')
const dmOpenError = ref('')
const notificationActionMessage = ref('')
const reportMessageId = ref('')
const reportSubmitting = ref(false)
const reportError = ref('')
const viewportMatchesMobile = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
const isMobile = ref(viewportMatchesMobile())
const updateViewport = () => { isMobile.value = viewportMatchesMobile() }
const mobileConversationOpen = computed(() => isMobile.value && Boolean(dmStore.activeConversation || dmStore.activeTarget))
const dmMailboxes = computed(() => dmStore.mailboxOrder.map(key => dmStore.mailboxesByKey[key]).filter(Boolean))
const dmConversations = computed(() => dmStore.conversationIdsByMailbox[dmStore.activeMailboxKey]?.map(id => dmStore.conversationsById[id]).filter(Boolean) || [])
const hasMoreConversations = computed(() => Boolean(dmStore.conversationCursorByMailbox[dmStore.activeMailboxKey]))

const activeTab = computed<InboxPageTab>(() => {
  const tab = route.query.tab
  if (tab === 'like' || tab === 'interaction' || tab === 'mention' || tab === 'reply' || tab === 'forum' || tab === 'collaboration' || tab === 'system' || tab === 'dm') return tab
  const firstUnread = tabs.find((item) => item.key !== 'forum' && notificationStore.unreadCounts[item.key] > 0)
  return firstUnread?.key || 'mention'
})

const selectedNotification = computed(() => notificationStore.notifications.find((item) => item.id === selectedNotificationId.value) || null)
const activeTabLabel = computed(() => tabs.find((item) => item.key === activeTab.value)?.label || '通知')
const tabUnreadCount = (tab: InboxPageTab) => tab === 'forum' ? 0 : notificationStore.unreadCounts[tab] || 0
const forumNotificationTypes: Notification['type'][] = ['forum_topic_comment', 'forum_follow']

const switchTab = async (tab: InboxPageTab) => {
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
  } finally {}
}

const reportMessage = async ({ messageId, reason, detail }: { messageId: string; reason: string; detail: string }) => {
  if (reportSubmitting.value) return
  reportSubmitting.value = true
  reportError.value = ''
  try { await dmStore.reportMessage(messageId, { reason, detail }); closeReportModal() } catch (error) { reportError.value = dmErrorMessage(error) } finally { reportSubmitting.value = false }
}

const closeReportModal = () => { reportMessageId.value = ''; reportError.value = '' }

const jumpToNotification = async (notification: Notification) => {
  await notificationStore.markRead(notification.id)
  const targetPath = notificationTargetPath(notification)
  if (!targetPath) return
  await router.push(targetPath)
}

const notificationTargetPath = (notification: Notification): RouteLocationRaw | string => {
  if (notification.source_url) {
    return notification.source_url
  }
  if (notification.type === 'content_mention' && notification.meta.module && notification.meta.path) {
    return referenceHref({ module: notification.meta.module, path: notification.meta.path })
  }
  if (isCommentNotification(notification)) return commentNotificationLocation(notification)
  if (notification.type === 'content_published') return contentPublishedLocation(notification)
  if (notification.type === 'forum_follow') return forumNotificationLocation(notification)
  if (notification.source_type === 'music_lyrics') {
    const { album_id: albumId, song_id: songId, annotation_id: annotationId } = notification.meta
    if (typeof albumId === 'string' && typeof songId === 'string' && typeof annotationId === 'string') {
      return {
        path: `/music/album/${albumId}`,
        query: { song_id: songId, annotation_id: annotationId, rebind: '1' },
      }
    }
  }
  const topicId = notification.meta.topic_id
  if (notification.source_type === 'forum_reply' && topicId) {
    return `/forum/topic/${topicId}#reply-${notification.source_id}`
  }
  if (notification.source_type === 'forum_topic' && notification.source_id) {
    return `/forum/topic/${notification.source_id}`
  }
  return ''
}

const notificationSourceLabel = (notification: Notification) => {
  return notification.meta.source_label || notification.meta.topic_title || ''
}

const muteNotificationType = async (notification: Notification) => {
  notificationActionMessage.value = (await notificationStore.savePreference(notification.category, notification.type, false))
    ? ''
    : '通知偏好暂不可用'
}

const muteNotificationSource = async (notification: Notification) => {
  notificationActionMessage.value = (await notificationStore.createMute(notification.source_type, notification.source_id, notification.reason))
    ? ''
    : '内容静音暂不可用'
}

const blockActiveConversation = async () => {
  await dmStore.blockActiveConversation()
}

const unblockActiveConversation = async () => {
  await dmStore.unblockActiveConversation()
}

const formatNotificationTitle = (notification: Notification) => {
  const actor = notification.actor?.display_name || notification.actor?.username || '有人'
  if (notification.type === 'forum_topic_comment') return '新评论'
  if (notification.type === 'forum_follow') return '新帖子'
  if (notification.meta.title) return notification.meta.title
  switch (notification.type) {
    case 'forum_reply':
      return `${actor} 回复了你`
    case 'forum_like':
      return `${actor} 赞了你`
    case 'forum_mention':
      return `${actor} 提到了你`
    case 'forum_solved':
      return `${actor} 采纳了你的回复`
    case 'comment_reply':
      return `${actor} 回复了你`
    case 'comment_mention':
      return `${actor} 提到了你`
    case 'content_mention':
      return `${actor} 提到了你`
    case 'comment_marked':
      return `${actor} 标记了你的评论`
    case 'comment_like':
      return notification.meta.like_count && notification.meta.like_count > 1
        ? `${actor} 等 ${notification.meta.like_count} 人赞了你`
        : `${actor} 赞了你`
    default:
      return '新通知'
  }
}

const formatNotificationBody = (notification: Notification) => {
  if (notification.type === 'forum_topic_comment' || notification.type === 'forum_follow') {
    return notification.meta.topic_title || notification.meta.title || '查看帖子'
  }
  if (notification.type === 'comment_reply') return '查看回复'
  if (notification.type === 'comment_mention') return '查看提及'
  if (notification.type === 'content_mention') return '查看提及'
  if (notification.type === 'comment_marked') return '查看标记'
  if (notification.type === 'comment_like') return '查看点赞'
  return notification.reason || notification.meta.body || notification.meta.reply_excerpt || notification.meta.topic_title || '查看详情'
}

const formatTime = (value?: string | null) => {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN')
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
  align-items: end;
  gap: 1rem;
}

.inbox-page {
  max-width: 92rem;
}

.inbox-shell {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.inbox-category-pane {
  min-width: 0;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.inbox-category-item {
  width: 100%;
  min-height: 3.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 1rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.inbox-category-item:hover {
  background: var(--a-color-bg);
  color: var(--a-color-text);
}

.inbox-category-item.active {
  border-left-color: var(--a-color-text);
  background: var(--a-color-bg);
  color: var(--a-color-text);
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
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1;
}

.inbox-body {
  display: grid;
  grid-template-columns: minmax(8.5rem, 11rem) minmax(17rem, 24rem) minmax(0, 1fr);
  min-height: 32rem;
}

.inbox-list-pane {
  min-width: 0;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
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

.sidebar-list {
  display: flex;
  flex-direction: column;
}

.sidebar-item {
  width: 100%;
  min-height: 5rem;
  border: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  background: transparent;
  padding: 0.9rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.sidebar-item:hover {
  background: var(--a-color-surface-muted);
}

.sidebar-item.selected {
  border-left-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.sidebar-item.unread .sidebar-item-title {
  font-weight: 500;
  color: var(--a-color-text);
}

.sidebar-item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.92rem;
  font-weight: 500;
}

.sidebar-item-source {
  margin-top: 0.25rem;
  color: var(--a-color-text-secondary);
  font-size: 0.74rem;
  font-weight: 500;
}

.sidebar-item-body {
  margin-top: 0.25rem;
  font-size: 0.82rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sidebar-item-time,
.detail-time {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  font-weight: 500;
}

.inbox-empty-state,
.detail-empty {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 0.4rem;
  color: var(--a-color-text-secondary);
}

.inbox-empty-state {
  min-height: 12rem;
  padding: 1.25rem;
}

.detail-empty {
  min-height: 100%;
  padding: 2rem;
  background: var(--a-color-bg);
}

.inbox-empty-state strong,
.detail-empty strong {
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 500;
}

.inbox-empty-state span,
.detail-empty span {
  font-size: 0.9rem;
}

.inbox-detail {
  min-width: 0;
  background: var(--a-color-bg);
}

.detail-card {
  min-height: 100%;
  padding: 2rem;
  background: var(--a-color-bg);
}

.detail-body {
  white-space: pre-wrap;
  max-width: 56rem;
  font-size: 1.05rem;
  line-height: 1.6;
  margin: 1rem 0;
}

.detail-reason,
.detail-source {
  margin: 0.75rem 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.detail-card-dm {
  min-height: 32rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
}

.dm-header {
  min-height: 3.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dm-messages {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  overflow-y: auto;
}

.dm-message {
  display: flex;
}

.dm-message.self {
  justify-content: flex-end;
}

.dm-bubble {
  max-width: 70%;
  padding: 0.75rem 1.25rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-none);
  font-size: 0.95rem;
  line-height: 1.5;
}

.dm-message.self .dm-bubble {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

.dm-composer {
  padding: 1.25rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.dm-blocked-state {
  margin: 0 0 1rem;
  color: var(--a-color-muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.dm-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.dm-file-input {
  display: none;
}

.dm-upload-preview {
  display: flex;
}

@media (max-width: 960px) {
  .inbox-body {
    grid-template-columns: 1fr;
  }

  .inbox-category-pane {
    display: flex;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--a-color-border-soft);
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

  .inbox-list-pane {
    border-right: none;
    border-bottom: 1px solid var(--a-color-border-soft);
  }
}

@media (max-width: 640px) {
  .inbox-header {
    align-items: stretch;
  }

  .detail-card,
  .detail-empty {
    padding: 1.25rem;
  }

  .dm-bubble {
    max-width: 100%;
  }

  .dm-actions {
    flex-direction: column;
  }
}

.dm-list-workspace { min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); }
.detail-card-dm { height:calc(100vh - 15rem); min-height:32rem; padding:0; }
@media (max-width: 767px) { .dm-list-workspace--hidden { display:none; }.inbox-detail:has(.detail-card-dm--mobile) { display:block; position:fixed; inset:0; z-index:30; background:var(--a-color-bg); }.detail-card-dm--mobile { display:block; height:100dvh; min-height:0; border:0; }.detail-card-dm--mobile :deep(.dm-conversation-pane) { height:100%; } }

</style>
