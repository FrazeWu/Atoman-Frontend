<template>
  <section
    class="dm-conversation-list"
    data-testid="dm-conversation-list"
    aria-label="私信会话"
  >
    <!-- 顶部搜索栏 -->
    <div class="dm-conversation-list__search">
      <div class="dm-conversation-list__search-wrapper">
        <Search class="dm-conversation-list__search-icon" :size="15" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜索联系人或消息..."
          class="dm-conversation-search-input"
          aria-label="搜索联系人或消息"
        />
      </div>
    </div>

    <!-- 会话列表项 -->
    <div class="dm-conversation-list__scroll-area">
      <button
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        type="button"
        class="dm-conversation-list__item sidebar-item"
        :class="{
          'is-active': conversation.id === activeConversationId,
          active: conversation.id === activeConversationId,
          selected: conversation.id === activeConversationId,
          unread: conversation.unread_count > 0,
        }"
        :data-testid="`dm-conversation-${conversation.id}`"
        @click="emit('open-conversation', conversation.id)"
      >
        <!-- 头像 / 首字母兜底 -->
        <div class="dm-conversation-list__avatar-wrap">
          <img
            v-if="conversation.other_party.avatar_url"
            :src="conversation.other_party.avatar_url"
            :alt="conversation.other_party.display_name"
            class="dm-conversation-list__avatar"
          />
          <span
            v-else
            class="dm-conversation-list__avatar-fallback"
            data-testid="dm-avatar-fallback"
          >
            {{ monogramFor(conversation.other_party.display_name) }}
          </span>
        </div>

        <!-- 内容信息 -->
        <div class="dm-conversation-list__content">
          <!-- 首行：联系人昵称与时间 -->
          <div class="dm-conversation-list__row">
            <span class="dm-conversation-list__name">{{ conversation.other_party.display_name }}</span>
            <time class="dm-conversation-list__time">{{ formatTime(conversation.last_message_at) }}</time>
          </div>

          <!-- 次行：最后消息与未读微标 -->
          <div class="dm-conversation-list__row dm-conversation-list__row--bottom">
            <div class="dm-conversation-list__preview-wrap">
              <Check
                v-if="conversation.last_message_is_outgoing"
                data-testid="dm-outgoing-icon"
                class="dm-conversation-list__outgoing-icon"
                :size="13"
                aria-label="已发送"
              />
              <span class="dm-conversation-list__preview">
                {{ conversation.last_message_preview || '图片消息' }}
              </span>
            </div>
            <span
              v-if="conversation.unread_count > 0"
              data-testid="dm-unread-badge"
              class="dm-conversation-list__unread"
            >
              {{ conversation.unread_count > 99 ? '99+' : conversation.unread_count }}
            </span>
          </div>
        </div>
      </button>

      <!-- 空状态 -->
      <p v-if="!loading && !filteredConversations.length" class="dm-conversation-list__empty">
        {{ searchQuery.trim() ? '无匹配会话' : '暂无私信' }}
      </p>

      <!-- 加载更多 -->
      <button
        v-if="hasMore"
        type="button"
        class="dm-conversation-list__more"
        @click="emit('load-more')"
      >
        加载更多
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Search } from 'lucide-vue-next'
import type { DMConversation } from '@/api/dm'

const props = defineProps<{
  conversations: DMConversation[]
  activeConversationId: string
  loading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  'open-conversation': [id: string]
  'load-more': []
}>()

const searchQuery = ref('')

const sortedConversations = computed(() =>
  [...props.conversations].sort((a, b) =>
    (b.last_message_at || '').localeCompare(a.last_message_at || '')
  )
)

const filteredConversations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return sortedConversations.value
  return sortedConversations.value.filter((conv) => {
    const name = (conv.other_party?.display_name || '').toLowerCase()
    const preview = (conv.last_message_preview || '').toLowerCase()
    return name.includes(query) || preview.includes(query)
  })
})

const monogramFor = (name?: string): string => {
  const trimmed = name?.trim()
  if (!trimmed) return '?'
  return (Array.from(trimmed)[0] || '?').toUpperCase()
}

const formatTime = (value: string | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
  const dateTime = date.getTime()

  if (dateTime >= todayStart) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  if (dateTime >= yesterdayStart) {
    return '昨天'
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.dm-conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--a-color-bg);
  box-shadow: none !important;
}

.dm-conversation-list__search {
  padding: 0.375rem 0.75rem 0.5rem;
  border-bottom: none;
  background: transparent;
}

.dm-conversation-list__search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--a-color-text) 5%, transparent);
  transition: border-color var(--a-motion-micro, 150ms) ease, background-color var(--a-motion-micro, 150ms) ease;
  box-shadow: none !important;
}

.dm-conversation-list__search-wrapper:focus-within {
  border-color: color-mix(in srgb, var(--a-color-primary) 35%, transparent);
  background: var(--a-color-bg);
  outline: none;
  box-shadow: none !important;
}

.dm-conversation-list__search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--a-color-muted);
  pointer-events: none;
}

.dm-conversation-search-input {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.75rem 0 2.25rem;
  font-size: 0.84rem;
  color: var(--a-color-text);
  background: transparent;
  border: none;
  outline: none;
}

.dm-conversation-search-input::placeholder {
  color: var(--a-color-muted);
}

.dm-conversation-list__search-kbd {
  margin-right: 0.5rem;
  padding: 0.15rem 0.35rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.6875rem;
  color: var(--a-color-muted);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
}

.dm-conversation-list__scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 0.25rem;
  padding-bottom: 0.5rem;
}

.dm-conversation-list__item {
  position: relative;
  width: calc(100% - 1rem);
  margin: 0.2rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--a-motion-micro, 150ms) ease;
  box-shadow: none !important;
}

.dm-conversation-list__item:hover {
  background: color-mix(in srgb, var(--a-color-text) 5%, transparent);
}

.dm-conversation-list__item.is-active,
.dm-conversation-list__item.active,
.dm-conversation-list__item.selected {
  background: color-mix(in srgb, var(--a-color-text) 8%, transparent);
  border-color: transparent;
  box-shadow: none !important;
}

.dm-conversation-list__avatar-wrap {
  position: relative;
  width: 2.625rem;
  height: 2.625rem;
  flex-shrink: 0;
  border-radius: 9999px;
  overflow: hidden;
  background: linear-gradient(135deg, color-mix(in srgb, var(--a-color-primary) 18%, var(--a-color-surface-muted)), var(--a-color-surface-muted));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none !important;
}

.dm-conversation-list__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dm-conversation-list__avatar-fallback {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--a-color-primary);
  user-select: none;
}

.dm-conversation-list__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dm-conversation-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.dm-conversation-list__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.dm-conversation-list__item.is-active .dm-conversation-list__name,
.dm-conversation-list__item.active .dm-conversation-list__name {
  font-weight: 700;
}

.dm-conversation-list__time {
  font-size: 0.6875rem;
  color: var(--a-color-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.dm-conversation-list--linear .dm-conversation-list__time {
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.dm-conversation-list__row--bottom {
  align-items: center;
}

.dm-conversation-list__preview-wrap {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.dm-conversation-list__outgoing-icon {
  flex-shrink: 0;
  color: var(--a-color-primary);
}

.dm-conversation-list__preview {
  font-size: 0.8125rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-conversation-list__item.is-active .dm-conversation-list__preview,
.dm-conversation-list__item.active .dm-conversation-list__preview {
  color: var(--a-color-text-secondary);
}

.dm-conversation-list__unread {
  flex-shrink: 0;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast, #ffffff);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
}

.dm-conversation-list--linear .dm-conversation-list__unread {
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.625rem;
}

.dm-conversation-list__empty {
  margin: 2.5rem 1rem;
  text-align: center;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.dm-conversation-list__more {
  display: block;
  width: calc(100% - 1.5rem);
  margin: 1rem auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 8px);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--a-motion-micro, 150ms) ease;
}

.dm-conversation-list__more:hover {
  background: var(--a-color-surface-muted);
}
</style>
