<template>
  <section class="dm-conversation-pane" data-testid="dm-conversation-pane">
    <!-- 头部栏 -->
    <header class="dm-conversation-header">
      <button
        v-if="mobile"
        type="button"
        class="dm-header-back-btn"
        aria-label="返回会话列表"
        @click="emit('back')"
      >
        返回
      </button>

      <h2>{{ conversation?.other_party.display_name || targetLabel }}</h2>

      <div class="dm-header-actions">
        <button
          v-if="conversation"
          type="button"
          data-testid="dm-header-block-btn"
          class="dm-header-block-btn"
          @click="toggleBlock"
        >
          {{ conversation.blocked ? '取消拉黑' : '拉黑' }}
        </button>

        <button
          v-if="conversation"
          type="button"
          data-testid="dm-toggle-drawer"
          class="dm-header-drawer-btn"
          aria-label="联系人详情"
          title="联系人详情"
          @click="emit('toggle-drawer')"
        >
          <Info :size="18" />
        </button>
      </div>
    </header>

    <!-- 消息滚动区 -->
    <div ref="scroller" class="dm-conversation-pane__messages" @scroll="onScroll">
      <button
        v-if="hasMore"
        data-testid="dm-load-older"
        type="button"
        class="dm-load-older-btn"
        :disabled="loading"
        @click="requestOlder"
      >
        加载更早消息
      </button>

      <p v-if="!messages.length" class="dm-conversation-pane__empty">开始一段对话</p>

      <template v-for="group in groupedMessages" :key="group.id">
        <!-- 跨自然日居中日期指示条 -->
        <div v-if="group.showDateDivider" class="dm-date-divider">
          <span>{{ group.dateLabel }}</span>
        </div>

        <!-- 连续消息成组 -->
        <div class="dm-message-group" :class="{ self: group.isSelf }">
          <span
            v-if="!group.isSelf && group.sender.display_name && !isUUID(group.sender.display_name)"
            class="dm-message-group__sender"
          >
            {{ group.sender.display_name }}
          </span>

          <article
            v-for="message in group.messages"
            :key="message.id"
            class="dm-message"
            :class="{ self: message.sender.id === conversation?.reply_as.id }"
            :data-message-id="message.id"
            tabindex="0"
          >
            <!-- 气泡 -->
            <div class="dm-bubble">
              <img
                v-if="message.image_url"
                :src="message.image_url"
                alt="私信图片"
                class="dm-bubble-image"
              />
              <span v-if="message.content" class="dm-bubble-text">{{ message.content }}</span>
              <span class="dm-bubble-meta">
                <time class="dm-bubble-time">{{ formatMessageTime(message.created_at) }}</time>
                <CheckCheck
                  v-if="message.sender.id === conversation?.reply_as.id && message.read_at"
                  class="dm-bubble-check read"
                  :size="11"
                  aria-label="已读"
                />
                <Check
                  v-else-if="message.sender.id === conversation?.reply_as.id"
                  class="dm-bubble-check unread"
                  :size="10"
                  aria-label="已发送未读"
                />
              </span>
            </div>

            <!-- 悬浮微操作工具条 -->
            <div class="dm-message-toolbar" role="toolbar" aria-label="消息快捷操作">
              <button
                v-if="message.content"
                type="button"
                class="dm-toolbar-btn"
                data-testid="dm-copy-message"
                aria-label="复制消息"
                title="复制消息"
                @click="copyMessage(message.content)"
              >
                <Copy :size="13" />
              </button>
              <button
                v-if="message.sender.id !== conversation?.reply_as.id"
                type="button"
                class="dm-toolbar-btn"
                data-testid="dm-report-message"
                aria-label="举报消息"
                title="举报消息"
                @click="emit('report', message.id)"
              >
                <Flag :size="13" />
                <span class="sr-only">举报</span>
              </button>
            </div>
          </article>
        </div>
      </template>
    </div>

    <!-- 底部输入台插槽 -->
    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, CheckCheck, Copy, Flag, Info } from 'lucide-vue-next'
import { isUUID, type DMConversation, type DMMessage, type DMParty } from '@/api/dm'

const props = withDefaults(
  defineProps<{
    conversation?: DMConversation | null
    messages: DMMessage[]
    hasMore: boolean
    loading: boolean
    mobile?: boolean
    targetLabel?: string
  }>(),
  {
    conversation: null,
    mobile: false,
    targetLabel: '',
  }
)

const emit = defineEmits<{
  'load-older': []
  back: []
  block: []
  unblock: []
  report: [messageId: string]
  'toggle-drawer': []
}>()

const scroller = ref<HTMLElement | null>(null)
let previousHeight: number | null = null
let previousMessageCount = 0

const toggleBlock = () => {
  if (props.conversation?.blocked) emit('unblock')
  else emit('block')
}

const requestOlder = () => {
  if (!scroller.value || previousHeight !== null) return
  previousHeight = scroller.value.scrollHeight
  previousMessageCount = props.messages.length
  emit('load-older')
}

const onScroll = () => {
  if (scroller.value && scroller.value.scrollTop < 32 && props.hasMore) {
    requestOlder()
  }
}

watch(
  () => props.messages.length,
  async () => {
    if (!scroller.value) return
    if (previousHeight !== null) {
      const height = previousHeight
      previousHeight = null
      await nextTick()
      scroller.value.scrollTop += scroller.value.scrollHeight - height
    } else {
      await nextTick()
      scroller.value.scrollTop = scroller.value.scrollHeight
    }
  }
)

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading && previousHeight !== null && props.messages.length === previousMessageCount) {
      previousHeight = null
    }
  }
)

const formatMessageTime = (value: string): string => {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const formatDateDivider = (value: string): string => {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
  const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  if (dateDayStart === todayStart) return '今天'
  if (dateDayStart === yesterdayStart) return '昨天'

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (year === now.getFullYear()) {
    return `${month}月${day}日`
  }
  return `${year}年${month}月${day}日`
}

interface MessageGroup {
  id: string
  dateKey: string
  dateLabel: string
  showDateDivider: boolean
  senderId: string
  isSelf: boolean
  sender: DMParty
  messages: DMMessage[]
}

const resolveSender = (sender: DMParty): DMParty => {
  if (props.conversation) {
    if (sender.id === props.conversation.other_party.id) {
      const name = props.conversation.other_party.display_name && !isUUID(props.conversation.other_party.display_name)
        ? props.conversation.other_party.display_name
        : (!isUUID(sender.display_name) ? sender.display_name : (sender.type === 'channel' ? '频道' : '用户'))
      return {
        ...sender,
        display_name: name,
        avatar_url: sender.avatar_url || props.conversation.other_party.avatar_url,
      }
    }
    if (sender.id === props.conversation.reply_as.id || sender.id === props.conversation.mailbox?.id) {
      const selfParty = props.conversation.reply_as || props.conversation.mailbox
      const name = selfParty.display_name && !isUUID(selfParty.display_name)
        ? selfParty.display_name
        : (!isUUID(sender.display_name) ? sender.display_name : (sender.type === 'channel' ? '频道' : '用户'))
      return {
        ...sender,
        display_name: name,
        avatar_url: sender.avatar_url || selfParty.avatar_url,
      }
    }
  }
  if (isUUID(sender.display_name)) {
    const fallbackName = props.conversation?.other_party?.display_name && !isUUID(props.conversation.other_party.display_name)
      ? props.conversation.other_party.display_name
      : (props.targetLabel && !isUUID(props.targetLabel) ? props.targetLabel : (sender.type === 'channel' ? '频道' : '用户'))
    return { ...sender, display_name: fallbackName }
  }
  return sender
}

const groupedMessages = computed<MessageGroup[]>(() => {
  const groups: MessageGroup[] = []
  let lastDateKey = ''
  let currentGroup: MessageGroup | null = null
  let lastMsgTime = 0

  for (let i = 0; i < props.messages.length; i++) {
    const message = props.messages[i]
    const msgDate = new Date(message.created_at)
    const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth() + 1}-${msgDate.getDate()}`
    const msgTime = msgDate.getTime()
    const isSelf = message.sender.id === props.conversation?.reply_as.id
    const senderId = message.sender.id

    const isSameDay = dateKey === lastDateKey
    const isSameSender = currentGroup && currentGroup.senderId === senderId
    const isWithin5Minutes = currentGroup && Math.abs(msgTime - lastMsgTime) <= 5 * 60 * 1000

    if (currentGroup && isSameDay && isSameSender && isWithin5Minutes) {
      currentGroup.messages.push(message)
      lastMsgTime = msgTime
    } else {
      const showDateDivider = !isSameDay
      lastDateKey = dateKey
      lastMsgTime = msgTime
      currentGroup = {
        id: `group-${groups.length}`,
        dateKey,
        dateLabel: formatDateDivider(message.created_at),
        showDateDivider,
        senderId,
        isSelf,
        sender: resolveSender(message.sender),
        messages: [message],
      }
      groups.push(currentGroup)
    }
  }

  return groups
})

const copyMessage = async (content?: string) => {
  if (!content) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content)
    }
  } catch {
    // ignore
  }
}
</script>

<style scoped>
.dm-conversation-pane {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  background: var(--a-color-bg);
}

/* 头部栏 */
.dm-conversation-header {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.dm-conversation-header h2 {
  margin: 0;
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
  color: var(--a-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dm-header-block-btn {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  padding: 0.25rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro), border-color var(--a-motion-micro);
}

.dm-header-block-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.dm-header-drawer-btn,
.dm-header-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro), border-color var(--a-motion-micro);
}

.dm-header-drawer-btn {
  width: 2rem;
  padding: 0;
}

.dm-header-drawer-btn:hover,
.dm-header-back-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

/* 消息流与滚动区域 */
.dm-conversation-pane__messages {
  min-height: 0;
  overflow: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
}

.dm-load-older-btn {
  align-self: center;
  margin-bottom: 0.75rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro);
}

.dm-load-older-btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.dm-load-older-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dm-conversation-pane__empty {
  margin: auto;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

/* 日期指示条 */
.dm-date-divider {
  display: flex;
  justify-content: center;
  margin: 0.75rem 0;
}

.dm-date-divider span {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.2rem 0.65rem;
  border-radius: var(--a-radius-card);
  user-select: none;
}

/* 消息成组 */
.dm-message-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}

.dm-message-group.self {
  align-items: flex-end;
}

.dm-message-group:not(.self) {
  align-items: flex-start;
}

.dm-message-group__sender {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  margin-bottom: 2px;
  padding-left: 0.25rem;
}

/* 消息单项与气泡 */
.dm-message {
  position: relative;
  max-width: 78%;
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.dm-message.self {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.dm-bubble {
  position: relative;
  padding: 0.45rem 0.65rem;
  border-radius: var(--a-radius-card);
  word-break: break-word;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  line-height: 1.45;
}

.dm-message.self .dm-bubble {
  background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg));
  border: 1px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent);
  color: var(--a-color-text);
}

.dm-bubble-text {
  margin: 0;
  white-space: pre-wrap;
  font-size: 0.925rem;
  line-height: 1.45;
  display: inline;
}

.dm-bubble-image {
  display: block;
  max-width: 16rem;
  max-height: 16rem;
  margin-bottom: 0.35rem;
  object-fit: contain;
  border-radius: var(--a-radius-control);
}

/* 气泡微时间与对勾 */
.dm-bubble-meta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 0.4rem;
  font-size: 0.625rem;
  color: var(--a-color-muted);
  user-select: none;
  line-height: 1;
  white-space: nowrap;
  vertical-align: -1px;
}

.dm-message.self .dm-bubble-meta {
  color: color-mix(in srgb, var(--a-color-primary) 65%, var(--a-color-text-secondary));
}

.dm-bubble-image + .dm-bubble-meta:last-child {
  display: flex;
  justify-content: flex-end;
  margin-left: 0;
  margin-top: 0.25rem;
}

.dm-bubble-time {
  font-variant-numeric: tabular-nums;
}

.dm-bubble-check {
  color: var(--a-color-primary);
  flex-shrink: 0;
}

.dm-bubble-check.unread {
  opacity: 0.65;
}

.dm-bubble-check.read {
  opacity: 1;
}

/* 悬停微工具条 */
.dm-message-toolbar {
  opacity: 0;
  visibility: hidden;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  box-shadow: none;
  transition: opacity var(--a-motion-micro), visibility var(--a-motion-micro);
}

.dm-message:hover .dm-message-toolbar,
.dm-message:focus .dm-message-toolbar,
.dm-message:focus-within .dm-message-toolbar {
  opacity: 1;
  visibility: visible;
}

.dm-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro);
}

.dm-toolbar-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
