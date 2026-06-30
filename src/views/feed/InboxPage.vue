<template>
  <div class="a-page">
    <div class="a-section-header inbox-header">
      <div>
        <h1 class="a-title">{{ notificationRoom.name }}</h1>
        <p class="a-muted">{{ notificationRoom.homepageSub }}</p>
      </div>
    </div>

    <div class="inbox-layout">
      <aside class="inbox-sidebar">
        <div class="inbox-tabs">
          <PTab
            v-for="tab in tabs"
            :key="tab.key"
            :active="activeTab === tab.key"
            @click="switchTab(tab.key)"
            :label="tab.label"
          />
        </div>

        <div v-if="activeTab !== 'dm'" class="sidebar-list">
          <PPress variant="secondary" @click="markCurrentNotificationsRead" label="当前全部已读" />
          <button
            v-for="item in notificationStore.notifications"
            :key="item.id"
            class="sidebar-item"
            :class="{ unread: !item.read_at, selected: selectedNotificationId === item.id }"
            @click="openNotification(item.id)"
          >
            <div class="sidebar-item-title">{{ formatNotificationTitle(item) }}</div>
            <div class="sidebar-item-body a-muted">{{ formatNotificationBody(item) }}</div>
            <div class="sidebar-item-time">{{ formatTime(item.created_at) }}</div>
          </button>
          <PEmpty v-if="!notificationStore.loading && notificationStore.notifications.length === 0" title="暂无通知" />
        </div>

        <div v-else class="sidebar-list">
          <PPress variant="secondary" @click="dmStore.fetchConversations" label="刷新会话" />
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
          <PEmpty v-if="!dmStore.loading && dmStore.conversations.length === 0" title="暂无私信" />
        </div>
      </aside>

      <section class="inbox-detail">
        <template v-if="activeTab !== 'dm'">
          <div v-if="selectedNotification" class="detail-card">
            <h2 class="a-subtitle">{{ formatNotificationTitle(selectedNotification) }}</h2>
            <p class="detail-body a-muted">{{ formatNotificationBody(selectedNotification) }}</p>
            <p class="detail-time">{{ formatTime(selectedNotification.created_at) }}</p>
            <PButton @click="jumpToNotification(selectedNotification)">前往来源内容</PButton>
          </div>
          <PEmpty v-else title="选择一条通知" description="点击左侧通知查看详情。" />
        </template>

        <template v-else>
          <div v-if="dmStore.activeConversation" class="detail-card detail-card-dm">
            <div class="dm-header">
              <h2 class="a-subtitle">与 {{ dmStore.activeConversation }} 的对话</h2>
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
              <PTextarea v-model="dmContent" label="消息内容" :rows="3" placeholder="输入私信内容" :error="dmError || undefined" />
              <div v-if="dmImageUrl" class="dm-upload-preview">
                <img :src="dmImageUrl" alt="preview" class="dm-image" />
              </div>
              <div class="dm-actions">
                <input ref="fileInput" type="file" accept="image/*" class="dm-file-input" @change="uploadDMImage" />
                <PButton variant="secondary" type="button" @click="fileInput?.click()">上传图片</PButton>
                <PButton type="submit" :loading="dmSending" loadingText="发送中...">发送</PButton>
              </div>
            </form>
          </div>
          <PEmpty v-else :title="dmOpenError ? '无法打开会话' : '选择一个会话'" :description="dmOpenError || '点击左侧私信会话开始聊天。'" />
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'
import { useAuthStore } from '@/stores/auth'
import { notificationRoom } from '@/config/moduleRooms'
import type { InboxTab, Notification, NotificationFilterType } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const inboxStore = useInboxStore()
const notificationStore = useNotificationStore()
const dmStore = useDMStore()

const tabs: Array<{ key: InboxTab; label: string }> = [
  { key: 'reply', label: '回复我的' },
  { key: 'like', label: '给我的赞' },
  { key: 'mention', label: '@我的' },
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
  if (tab === 'like' || tab === 'mention' || tab === 'dm') return tab
  return 'reply'
})

const selectedNotification = computed(() => notificationStore.notifications.find((item) => item.id === selectedNotificationId.value) || null)

const notificationTypeByTab: Record<'reply' | 'like' | 'mention', NotificationFilterType> = {
  reply: 'forum_reply',
  like: 'forum_like',
  mention: 'forum_mention',
}

const switchTab = async (tab: InboxTab) => {
  await router.push({ path: '/feed/inbox', query: tab === 'reply' ? {} : { tab } })
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

  const type = notificationTypeByTab[activeTab.value]
  await notificationStore.fetchNotifications(type, 1)
  selectedNotificationId.value = notificationStore.notifications[0]?.id || null
}

const openNotification = async (id: string) => {
  selectedNotificationId.value = id
  await notificationStore.markRead(id)
}

const markCurrentNotificationsRead = async () => {
  if (activeTab.value === 'dm') return
  await notificationStore.markAllRead(notificationTypeByTab[activeTab.value])
}

const openConversation = async (username: string) => {
  dmOpenError.value = ''
  await router.replace({ path: '/feed/inbox', query: { tab: 'dm', user: username } })
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
  const topicId = notification.meta.topic_id
  if (notification.source_type === 'forum_reply' && topicId) {
    await router.push(`/forum/topic/${topicId}#reply-${notification.source_id}`)
    return
  }
  if (notification.source_type === 'forum_topic' && notification.source_id) {
    await router.push(`/forum/topic/${notification.source_id}`)
    return
  }
}

const formatNotificationTitle = (notification: Notification) => {
  const actor = notification.actor?.display_name || notification.actor?.username || '有人'
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
  return notification.meta.reply_excerpt || notification.meta.topic_title || '查看详情'
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
.inbox-layout {
  display: grid;
  grid-template-columns: 20rem minmax(0, 1fr);
  gap: 3rem;
  align-items: start;
}

.inbox-sidebar {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  position: sticky;
  top: 2rem;
}

.inbox-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-item {
  border: none;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  background: transparent;
  padding: 1rem 0.5rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-item:hover {
  background: var(--a-color-paper-wash);
}

.sidebar-item.selected {
  border-bottom-color: var(--a-color-ink);
  background: var(--a-color-paper-soft);
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
  font-size: 0.9rem;
  font-weight: 700;
}

.sidebar-item-body {
  margin-top: 0.25rem;
  font-size: 0.8rem;
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

.detail-card {
  padding: 2.5rem;
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
}

.detail-body {
  white-space: pre-wrap;
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 1.5rem 0;
}

.detail-card-dm {
  min-height: 60vh;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: white;
}

.dm-header {
  padding: 1.5rem 2.5rem;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
}

.dm-messages {
  padding: 2.5rem;
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
  padding: 2rem 2.5rem;
  border-top: 1.5px dashed var(--a-color-line-soft);
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
  .inbox-layout {
    grid-template-columns: 1fr;
  }

  .inbox-sidebar,
  .inbox-detail {
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .dm-bubble {
    max-width: 100%;
  }

  .dm-actions {
    flex-direction: column;
  }
}

</style>
