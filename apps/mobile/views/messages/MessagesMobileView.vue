<template>
  <div class="messages-mobile-view">
    <!-- View 1: Conversations List -->
    <div v-if="!activeConversation" class="conversations-pane">
      <header class="messages-header">
        <h1 class="messages-header__title">消息</h1>
      </header>

      <div v-if="conversations.length === 0" class="messages-empty" data-testid="messages-empty-state">
        <p class="messages-empty__title">暂无消息</p>
      </div>

      <div v-else class="conversations-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-item"
          data-testid="conversation-item"
          @click="openConversation(conv)"
        >
          <MAvatar :src="conv.avatar" :name="conv.partyName" :size="44" />
          <div class="conversation-item__content">
            <div class="conversation-item__top">
              <span class="conversation-item__name">{{ conv.partyName }}</span>
              <span class="conversation-item__time">{{ conv.updatedAt }}</span>
            </div>
            <div class="conversation-item__bottom">
              <span class="conversation-item__preview">{{ conv.lastMessage }}</span>
              <span v-if="conv.unreadCount > 0" class="conversation-item__badge">
                {{ conv.unreadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- View 2: Interactive Telegram-style Chat Pane -->
    <div v-else class="chat-pane" data-testid="chat-pane">
      <!-- Chat Header -->
      <header class="chat-header">
        <button
          type="button"
          class="chat-header__back"
          data-testid="chat-back-btn"
          aria-label="返回"
          @click="closeChat"
        >
          <MIcon name="chevron-left" size="md" />
        </button>

        <div class="chat-header__info">
          <span class="chat-header__title" data-testid="chat-header-title">{{ activeConversation.partyName }}</span>
        </div>

        <div class="chat-header__avatar">
          <MAvatar :src="activeConversation.avatar" :name="activeConversation.partyName" :size="32" />
        </div>
      </header>

      <!-- Message Bubbles Stream -->
      <main class="chat-messages">
        <div
          v-for="msg in activeMessages"
          :key="msg.id"
          class="message-bubble-row"
          :class="{ 'is-me': msg.isMe }"
        >
          <div class="message-bubble" :class="{ 'is-me': msg.isMe }">
            <p class="message-bubble__text">{{ msg.text }}</p>
            <span class="message-bubble__time">{{ msg.time }}</span>
          </div>
        </div>
      </main>

      <!-- Chat Composer -->
      <footer class="chat-composer">
        <div class="chat-composer__input" data-testid="chat-input">
          <MInput
            v-model="inputText"
            placeholder="输入消息..."
            @keydown.enter="sendMessage"
          />
        </div>
        <MButton
          size="md"
          variant="primary"
          data-testid="chat-send-btn"
          :disabled="!inputText.trim()"
          @click="sendMessage"
        >
          发送
        </MButton>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import MButton from '@mobile/components/ui/MButton.vue'

export interface Conversation {
  id: string
  partyName: string
  avatar?: string
  lastMessage: string
  unreadCount: number
  updatedAt: string
}

export interface ChatMessage {
  id: string
  text: string
  time: string
  isMe: boolean
}

const props = withDefaults(
  defineProps<{
    initialConversations?: Conversation[]
  }>(),
  {
    initialConversations: undefined,
  }
)

const defaultConversations: Conversation[] = [
  {
    id: 'conv-1',
    partyName: 'Alice',
    avatar: '/avatars/alice.png',
    lastMessage: '新设计的阅读器非常轻盈！',
    unreadCount: 2,
    updatedAt: '10:42',
  },
  {
    id: 'conv-2',
    partyName: 'Bob',
    avatar: '',
    lastMessage: '辩题观点已提交，请查看。',
    unreadCount: 0,
    updatedAt: '09:15',
  },
]

const conversations = ref<Conversation[]>(
  props.initialConversations ? [...props.initialConversations] : [...defaultConversations]
)

const activeConversation = ref<Conversation | null>(null)
const inputText = ref('')

const activeMessages = ref<ChatMessage[]>([])

function openConversation(conv: Conversation) {
  activeConversation.value = conv
  conv.unreadCount = 0
  activeMessages.value = [
    {
      id: 'm-1',
      text: conv.lastMessage,
      time: conv.updatedAt,
      isMe: false,
    },
  ]
}

function closeChat() {
  activeConversation.value = null
  inputText.value = ''
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !activeConversation.value) return

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  activeMessages.value.push({
    id: `m-${Date.now()}`,
    text,
    time: timeStr,
    isMe: true,
  })

  activeConversation.value.lastMessage = text
  activeConversation.value.updatedAt = timeStr
  inputText.value = ''
}
</script>

<style scoped>
.messages-mobile-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  box-sizing: border-box;
}

/* Conversations List Pane */
.conversations-pane {
  display: flex;
  flex-direction: column;
}

.messages-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding: 16px;
  box-sizing: border-box;
}

.messages-header__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.conversations-list {
  display: flex;
  flex-direction: column;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  cursor: pointer;
  background-color: #ffffff;
  transition: background-color 0.15s ease;
}

.conversation-item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.conversation-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.conversation-item__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.conversation-item__time {
  font-size: 0.6875rem;
  color: var(--a-color-muted, #94a3b8);
}

.conversation-item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conversation-item__preview {
  font-size: 0.8125rem;
  color: var(--a-color-muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.conversation-item__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background-color: var(--a-color-primary, #0f172a);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}

.messages-empty {
  padding: 64px 16px;
  text-align: center;
  color: var(--a-color-muted, #64748b);
}

/* Chat Pane */
.chat-pane {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.chat-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  flex-shrink: 0;
}

.chat-header__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  padding: 0;
}

.chat-header__info {
  flex: 1;
  text-align: center;
  margin: 0 8px;
}

.chat-header__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.chat-header__avatar {
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-bubble-row {
  display: flex;
  justify-content: flex-start;
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
  box-sizing: border-box;
}

.message-bubble.is-me {
  background-color: var(--a-color-primary, #0f172a);
  border-color: var(--a-color-primary, #0f172a);
  color: #ffffff;
}

.message-bubble__text {
  margin: 0 0 4px 0;
  font-size: 0.875rem;
  line-height: 1.45;
  word-break: break-word;
}

.message-bubble__time {
  display: block;
  font-size: 0.625rem;
  text-align: right;
  opacity: 0.7;
}

.chat-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background-color: #ffffff;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  flex-shrink: 0;
}

.chat-composer__input {
  flex: 1;
}
</style>
