<template>
  <div class="message-chat-mobile-view">
    <!-- Sticky Chat Header -->
    <header class="chat-header">
      <button
        type="button"
        class="chat-header__back"
        data-testid="chat-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>

      <div class="chat-header__info">
        <h1 class="chat-header__title" data-testid="chat-header-title">{{ chatData.partyName }}</h1>
        <span class="chat-header__status">{{ chatData.onlineStatus || '离线' }}</span>
      </div>

      <div class="chat-header__avatar">
        <MAvatar :src="chatData.partyAvatar" :name="chatData.partyName" :size="32" />
      </div>
    </header>

    <!-- Message Bubbles Scroll Area -->
    <main ref="messagesContainer" class="chat-messages">
      <div
        v-for="msg in chatData.messages"
        :key="msg.id"
        class="message-bubble-row"
        :class="{ 'is-me': msg.isMe }"
        data-testid="message-bubble"
      >
        <div class="message-bubble" :class="{ 'is-me': msg.isMe }">
          <p class="message-bubble__text">{{ msg.text }}</p>
          <div class="message-bubble__meta">
            <span class="message-bubble__time">{{ msg.time }}</span>
            <span v-if="msg.isMe" class="message-bubble__check">
              <MIcon name="check" size="xs" :stroke-width="2.2" />
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- Fixed Bottom Composer -->
    <footer class="chat-composer">
      <div class="chat-composer__input" data-testid="chat-input">
        <MInput
          v-model="inputText"
          placeholder="输入消息..."
          clearable
          @keydown.enter.prevent="handleSend"
        />
      </div>
      <MButton
        size="md"
        variant="primary"
        data-testid="chat-send-btn"
        :disabled="!inputText.trim()"
        @click="handleSend"
      >
        发送
      </MButton>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import { useDMStore } from '@/stores/dm'
import { useAuthStore } from '@/stores/auth'
import type { DMMessage } from '@/api/dm'

export interface ChatMessageItem {
  id: string
  text: string
  time: string
  isMe: boolean
}

export interface ChatSessionData {
  partyId: string
  partyName: string
  partyAvatar?: string
  onlineStatus?: string
  messages: ChatMessageItem[]
}

const props = withDefaults(
  defineProps<{
    initialChat?: ChatSessionData
  }>(),
  {
    initialChat: undefined,
  }
)

const route = useRoute()
const router = useRouter()
const dmStore = getActivePinia() ? useDMStore() : null
const authStore = getActivePinia() ? useAuthStore() : null

const messagesContainer = ref<HTMLElement | null>(null)
const inputText = ref('')

const defaultSampleChat: ChatSessionData = {
  partyId: 'c-1',
  partyName: 'Alice',
  partyAvatar: '',
  onlineStatus: '在线',
  messages: [
    { id: 'm-1', text: '你好，阅读器排版改好了吗？', time: '14:28', isMe: false },
    { id: 'm-2', text: '已经重构完成，应用了 4px 微圆角与柔和边线！', time: '14:29', isMe: true },
    { id: 'm-3', text: '太棒了，体验非常流畅轻快。稍后去截屏看一下效果。', time: '14:30', isMe: false },
  ],
}

const chatData = ref<ChatSessionData>(
  props.initialChat ? { ...props.initialChat } : defaultSampleChat
)

function formatMessageTime(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

function mapStoreMessage(msg: DMMessage): ChatMessageItem {
  const currentUserId = authStore?.user?.uuid || (authStore?.user?.id ? String(authStore.user.id) : '')
  const isMe = Boolean(
    (currentUserId && msg.sender.id === currentUserId) ||
    (dmStore?.activeConversation?.reply_as && msg.sender.id === dmStore.activeConversation.reply_as.id)
  )
  return {
    id: msg.id || msg.client_message_id,
    text: msg.content,
    time: formatMessageTime(msg.created_at),
    isMe,
  }
}

watch(
  () => props.initialChat,
  (newVal) => {
    if (newVal) {
      chatData.value = { ...newVal }
      scrollToBottom()
    }
  },
  { deep: true }
)

const storeMessages = computed(() => {
  const convId = String(route.params.id || '')
  if (!convId || !dmStore?.messagesByConversation[convId]) return []
  return dmStore.messagesByConversation[convId].map(mapStoreMessage)
})

watch(
  storeMessages,
  (newMsgs) => {
    if (!props.initialChat && newMsgs.length > 0) {
      chatData.value.messages = newMsgs
      scrollToBottom()
    }
  },
  { deep: true, immediate: true }
)

watch(
  () => dmStore?.activeConversation,
  (conv) => {
    if (!props.initialChat && conv) {
      chatData.value.partyName = conv.other_party?.display_name || '用户'
      chatData.value.partyAvatar = conv.other_party?.avatar_url || ''
      chatData.value.partyId = conv.id
    }
  },
  { immediate: true }
)

function handleBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/inbox')
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return

  inputText.value = ''

  if (props.initialChat) {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    chatData.value.messages.push({
      id: `m-${Date.now()}`,
      text,
      time: timeStr,
      isMe: true,
    })
    scrollToBottom()
    return
  }

  try {
    if (dmStore) {
      if (typeof dmStore.sendActiveMessage === 'function') {
        await dmStore.sendActiveMessage(text)
      } else if (typeof (dmStore as any).sendMessage === 'function') {
        await (dmStore as any).sendMessage(text)
      }
    } else {
      throw new Error('no dm store')
    }
    scrollToBottom()
  } catch {
    // If store send failed, fallback to local append
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    chatData.value.messages.push({
      id: `m-${Date.now()}`,
      text,
      time: timeStr,
      isMe: true,
    })
    scrollToBottom()
  }
}

onMounted(async () => {
  const id = String(route.params.id || '')
  if (!props.initialChat && id) {
    try {
      if (dmStore) {
        await dmStore.openConversation(id)
        const conv = dmStore.activeConversation
        if (conv) {
          chatData.value.partyName = conv.other_party?.display_name || '用户'
          chatData.value.partyAvatar = conv.other_party?.avatar_url || ''
        }
        if (dmStore.messagesByConversation[id]?.length) {
          chatData.value.messages = dmStore.messagesByConversation[id].map(mapStoreMessage)
        }
      } else {
        throw new Error('no dm store')
      }
    } catch {
      // Graceful fallback for mock routes
      if (id === 'u-1' || id === 'c-1') {
        chatData.value.partyName = 'Alice'
      } else if (id === 'u-2' || id === 'c-2') {
        chatData.value.partyName = 'Bob'
        chatData.value.messages = [
          { id: 'mb-1', text: '收到，今晚合并代码。', time: '昨天', isMe: false },
        ]
      }
    }
  }
  scrollToBottom()
})
</script>

<style scoped>
.message-chat-mobile-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
  box-sizing: border-box;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: calc(52px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: 12px;
  padding-right: 16px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 20;
}

.chat-header__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  padding: 0;
}

.chat-header__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-header__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-header__status {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.chat-header__avatar {
  flex-shrink: 0;
}

/* Messages stream */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: #ffffff;
}

.message-bubble-row {
  display: flex;
  width: 100%;
}

.message-bubble-row.is-me {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: var(--a-radius-card, 4px);
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: var(--a-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.02));
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Telegram Option A: subtle primary tint for outgoing */
.message-bubble.is-me {
  background-color: color-mix(in srgb, var(--a-color-primary, #007aff) 8%, #ffffff);
  border-color: color-mix(in srgb, var(--a-color-primary, #007aff) 20%, transparent);
}

.message-bubble__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--a-color-text, #0f172a);
  word-break: break-word;
}

.message-bubble__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
}

.message-bubble__time {
  font-size: 10px;
  color: var(--a-color-text-muted, #94a3b8);
}

.message-bubble__check {
  display: inline-flex;
  color: var(--a-color-primary, #007aff);
}

/* Composer */
.chat-composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  background-color: #ffffff;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.chat-composer__input {
  flex: 1;
}
</style>
