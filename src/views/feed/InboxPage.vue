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

          <div v-else class="sidebar-list">
            <button
              v-for="conversation in dmStore.conversations"
              :key="conversation.conversation_id"
              class="sidebar-item"
              :class="{ unread: conversation.unread_count > 0, selected: dmStore.activeConversation === conversation.other_username }"
              @click="openConversation(conversation.other_username)"
            >
              <div class="sidebar-item-title">
                <span>{{ conversation.other_username }}</span>
                <PBadge v-if="conversation.unread_count > 0" type="internal" fill>{{ conversation.unread_count }}</PBadge>
              </div>
              <div class="sidebar-item-body a-muted">{{ conversation.preview }}</div>
              <div class="sidebar-item-time">{{ formatTime(conversation.last_message_at) }}</div>
            </button>
            <div v-if="!dmStore.loading && dmStore.conversations.length === 0" class="inbox-empty-state">
              <strong>暂无私信</strong>
              <span>还没有新的会话。</span>
            </div>
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
            </div>
            <div v-else class="detail-empty">
              <strong>选择一条通知</strong>
              <span>点击左侧通知查看详情。</span>
            </div>
          </template>

          <template v-else>
            <div v-if="dmStore.activeConversation" class="detail-card detail-card-dm">
              <div class="dm-header">
                <h2 class="a-subtitle">与 {{ dmStore.activeConversation }} 的对话</h2>
                <PButton v-if="dmStore.activeConversationBlocked" variant="secondary" @click="unblockActiveConversation">取消拉黑</PButton>
                <PButton v-else variant="secondary" @click="blockActiveConversation">拉黑</PButton>
              </div>

              <div class="dm-messages">
                <div
                  v-for="message in dmStore.messages"
                  :key="message.id"
                  class="dm-message"
                  :class="{ self: message.sender_id === authStore.user?.uuid }"
                >
                  <div class="dm-bubble">
                    <p v-if="message.content">{{ message.content }}</p>
                    <img v-if="message.image_url" :src="message.image_url" alt="dm image" class="dm-image" />
                  </div>
                </div>
              </div>

              <form class="dm-composer" @submit.prevent="submitDM">
                <p v-if="dmStore.activeConversationBlocked" class="dm-blocked-state">已拉黑此用户</p>
                <PTextarea
                  v-model="dmContent"
                  label="消息内容"
                  :rows="3"
                  :placeholder="dmStore.activeConversationBlocked ? '已拉黑此用户' : '输入私信'"
                  :disabled="dmStore.activeConversationBlocked"
                  :error="dmError || undefined"
                />
                <div v-if="dmImageUrl" class="dm-upload-preview">
                  <img :src="dmImageUrl" alt="preview" class="dm-image" />
                </div>
                <div class="dm-actions">
                  <input ref="fileInput" type="file" accept="image/*" class="dm-file-input" @change="uploadDMImage" />
                  <PButton variant="secondary" type="button" :disabled="dmStore.activeConversationBlocked" @click="fileInput?.click()">上传图片</PButton>
                  <PButton type="submit" :disabled="dmStore.activeConversationBlocked" :loading="dmSending" loadingText="发送中...">发送</PButton>
                </div>
              </form>
            </div>
            <div v-else class="detail-empty">
              <strong>{{ dmOpenError ? '无法打开会话' : '选择一个会话' }}</strong>
              <span>{{ dmOpenError || '点击左侧私信会话开始聊天。' }}</span>
            </div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'
import { useUserBlocksStore } from '@/stores/userBlocks'
import { useAuthStore } from '@/stores/auth'
import type { InboxTab, Notification, NotificationCategory } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const inboxStore = useInboxStore()
const notificationStore = useNotificationStore()
const dmStore = useDMStore()
const userBlocksStore = useUserBlocksStore()

const tabs: Array<{ key: InboxTab; label: string }> = [
  { key: 'like', label: '点赞' },
  { key: 'interaction', label: '互动' },
  { key: 'mention', label: '@我' },
  { key: 'reply', label: '回复我' },
  { key: 'collaboration', label: '协作' },
  { key: 'system', label: '系统' },
  { key: 'dm', label: '私信' },
]

const selectedNotificationId = ref<string | null>(null)
const dmContent = ref('')
const dmImageUrl = ref('')
const dmSending = ref(false)
const dmError = ref('')
const dmOpenError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const activeTab = computed<InboxTab>(() => {
  const tab = route.query.tab
  if (tab === 'like' || tab === 'interaction' || tab === 'mention' || tab === 'reply' || tab === 'collaboration' || tab === 'system' || tab === 'dm') return tab
  const firstUnread = tabs.find((item) => notificationStore.unreadCounts[item.key] > 0)
  return firstUnread?.key || 'mention'
})

const selectedNotification = computed(() => notificationStore.notifications.find((item) => item.id === selectedNotificationId.value) || null)
const activeTabLabel = computed(() => tabs.find((item) => item.key === activeTab.value)?.label || '通知')
const tabUnreadCount = (tab: InboxTab) => notificationStore.unreadCounts[tab] || 0

const switchTab = async (tab: InboxTab) => {
  await router.push({ path: '/inbox', query: { tab } })
}

const loadTab = async () => {
  if (activeTab.value === 'dm') {
    dmOpenError.value = ''
    await dmStore.fetchConversations()
    const user = typeof route.query.user === 'string' ? route.query.user : ''
    if (user) {
      try {
        await openConversation(user)
      } catch (error) {
        dmOpenError.value = error instanceof Error ? error.message : '打开私信失败'
      }
    }
    return
  }

  await notificationStore.fetchNotifications(activeTab.value as NotificationCategory, 1)
  selectedNotificationId.value = notificationStore.notifications[0]?.id || null
}

const openNotification = async (id: string) => {
  selectedNotificationId.value = id
  await notificationStore.markRead(id)
}

const markCurrentNotificationsRead = async () => {
  if (activeTab.value === 'dm') return
  await notificationStore.markAllRead(activeTab.value as NotificationCategory)
}

const openConversation = async (username: string) => {
  dmOpenError.value = ''
  await router.replace({ path: '/inbox', query: { tab: 'dm', user: username } })
  await dmStore.openConversation(username)
}

const submitDM = async () => {
  if (!dmStore.activeConversation || (!dmContent.value.trim() && !dmImageUrl.value)) return
  dmSending.value = true
  dmError.value = ''
  try {
    await dmStore.sendMessage(dmStore.activeConversation, dmContent.value.trim(), dmImageUrl.value)
    dmContent.value = ''
    dmImageUrl.value = ''
  } catch (error) {
    dmError.value = error instanceof Error ? error.message : '发送失败'
  } finally {
    dmSending.value = false
  }
}

const uploadDMImage = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    dmImageUrl.value = await dmStore.uploadImage(file)
  } catch (error) {
    dmError.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    target.value = ''
  }
}

const jumpToNotification = async (notification: Notification) => {
  await notificationStore.markRead(notification.id)
  const targetPath = notificationTargetPath(notification)
  if (!targetPath) return
  await router.push(targetPath)
}

const notificationTargetPath = (notification: Notification) => {
  if (notification.source_url) {
    return notification.source_url
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
  await notificationStore.savePreference(notification.category, notification.type, false)
}

const muteNotificationSource = async (notification: Notification) => {
  await notificationStore.createMute(notification.source_type, notification.source_id, notification.reason)
}

const activeConversationItem = computed(() => (
  dmStore.conversations.find((item) => item.other_username === dmStore.activeConversation) || null
))

const blockActiveConversation = async () => {
  const userID = activeConversationItem.value?.other_user_id
  if (!userID) return
  await userBlocksStore.blockUser(userID)
  if (activeConversationItem.value) activeConversationItem.value.is_blocked = true
}

const unblockActiveConversation = async () => {
  const userID = activeConversationItem.value?.other_user_id
  if (!userID) return
  await userBlocksStore.unblockUser(userID)
  if (activeConversationItem.value) activeConversationItem.value.is_blocked = false
}

const formatNotificationTitle = (notification: Notification) => {
  const actor = notification.actor?.display_name || notification.actor?.username || '有人'
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
    default:
      return '新通知'
  }
}

const formatNotificationBody = (notification: Notification) => {
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
  await inboxStore.bootstrap()
  await loadTab()
})
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.inbox-category-pane {
  min-width: 0;
  border-right: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
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
  border-bottom: 1px solid var(--a-color-line-soft);
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--a-color-ink-muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.inbox-category-item:hover {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}

.inbox-category-item.active {
  border-left-color: var(--a-color-ink);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}

.inbox-category-item:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
}

.tab-count {
  min-width: 1.25rem;
  height: 1.25rem;
  display: grid;
  place-items: center;
  padding: 0 0.35rem;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1;
}

.inbox-body {
  display: grid;
  grid-template-columns: minmax(8.5rem, 11rem) minmax(17rem, 24rem) minmax(0, 1fr);
  min-height: 32rem;
}

.inbox-list-pane {
  min-width: 0;
  border-right: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.pane-heading {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  color: var(--a-color-ink);
  font-size: 0.8rem;
  font-weight: 900;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
}

.sidebar-item {
  width: 100%;
  min-height: 5rem;
  border: none;
  border-bottom: 1px solid var(--a-color-line-soft);
  border-left: 3px solid transparent;
  background: transparent;
  padding: 0.9rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.sidebar-item:hover {
  background: var(--a-color-paper-wash);
}

.sidebar-item.selected {
  border-left-color: var(--a-color-ink);
  background: var(--a-color-paper-wash);
}

.sidebar-item.unread .sidebar-item-title {
  font-weight: 950;
  color: var(--a-color-ink);
}

.sidebar-item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.92rem;
  font-weight: 700;
}

.sidebar-item-source {
  margin-top: 0.25rem;
  color: var(--a-color-ink-muted);
  font-size: 0.74rem;
  font-weight: 800;
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
  color: var(--a-color-ink-muted);
}

.inbox-empty-state {
  min-height: 12rem;
  padding: 1.25rem;
}

.detail-empty {
  min-height: 100%;
  padding: 2rem;
  background: var(--a-color-paper);
}

.inbox-empty-state strong,
.detail-empty strong {
  color: var(--a-color-ink);
  font-size: 1.05rem;
  font-weight: 900;
}

.inbox-empty-state span,
.detail-empty span {
  font-size: 0.9rem;
}

.inbox-detail {
  min-width: 0;
  background: var(--a-color-paper);
}

.detail-card {
  min-height: 100%;
  padding: 2rem;
  background: var(--a-color-paper);
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
  background: var(--a-color-paper);
}

.dm-header {
  min-height: 3.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
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
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  border-radius: var(--a-radius-none);
  font-size: 0.95rem;
  line-height: 1.5;
}

.dm-message.self .dm-bubble {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}

.dm-composer {
  padding: 1.25rem;
  border-top: 1px solid var(--a-color-line-soft);
}

.dm-blocked-state {
  margin: 0 0 1rem;
  color: var(--a-color-muted);
  font-size: 0.9rem;
  font-weight: 700;
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
    border-bottom: 1px solid var(--a-color-line-soft);
  }

  .inbox-category-item {
    min-width: 5.5rem;
    justify-content: center;
    border-left: none;
    border-bottom: 3px solid transparent;
  }

  .inbox-category-item.active {
    border-bottom-color: var(--a-color-ink);
  }

  .inbox-list-pane {
    border-right: none;
    border-bottom: 1px solid var(--a-color-line-soft);
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

</style>
