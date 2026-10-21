<template>
  <div class="messages-mobile-view">
    <!-- Header -->
    <header class="messages-header">
      <div class="messages-header__top">
        <h1 class="messages-header__title">私信</h1>
        <router-link to="/inbox/contacts" class="messages-header__new-btn" title="发起私信">
          <MIcon name="edit" size="xs" />
          <span>新私信</span>
        </router-link>
      </div>

      <!-- Search Bar -->
      <div class="messages-header__search">
        <MInput
          v-model="searchQuery"
          placeholder="搜索联系人或聊天记录..."
          clearable
          data-testid="messages-search-input"
        />
      </div>
    </header>

    <!-- Content -->
    <main class="messages-content">
      <div v-if="filteredConversations.length > 0" class="conversations-list">
        <article
          v-for="conv in filteredConversations"
          :key="conv.id"
          class="conversation-item"
          data-testid="conversation-item"
          @click="openConversation(conv)"
        >
          <div class="conversation-item__avatar-wrap">
            <MAvatar :src="conv.avatar" :name="conv.partyName" :size="44" />
            <span v-if="conv.online" class="conversation-item__online-dot" />
          </div>

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
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="messages-empty" data-testid="messages-empty-state">
        <div class="messages-empty__icon">
          <MIcon name="messages" size="lg" />
        </div>
        <p class="messages-empty__title">
          {{ searchQuery ? '未找到相关私信' : '暂无私信消息' }}
        </p>
        <p class="messages-empty__desc">
          {{ searchQuery ? '换个关键词搜搜看，或前往联系人发起新对话。' : '去关注或搜索感兴趣的创作者，随时发起交流。' }}
        </p>
        <router-link to="/inbox/contacts" class="messages-empty__btn">
          查看联系人
        </router-link>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import { useDMStore } from '@/stores/dm'

export interface Conversation {
  id: string
  partyName: string
  avatar?: string
  lastMessage: string
  unreadCount: number
  updatedAt: string
  online?: boolean
}

const props = withDefaults(
  defineProps<{
    initialConversations?: Conversation[]
  }>(),
  {
    initialConversations: undefined,
  }
)

const router = useRouter()
const searchQuery = ref('')

const defaultSampleConversations: Conversation[] = [
  {
    id: 'c-1',
    partyName: 'Alice',
    avatar: '',
    lastMessage: '新设计的阅读器非常轻快！',
    unreadCount: 2,
    updatedAt: '14:30',
    online: true,
  },
  {
    id: 'c-2',
    partyName: 'Bob',
    avatar: '',
    lastMessage: '收到，今晚合并代码。',
    unreadCount: 0,
    updatedAt: '昨天',
    online: false,
  },
  {
    id: 'c-3',
    partyName: 'Elena Vance',
    avatar: '',
    lastMessage: '排版细节整理成了一篇短笺，已发布。',
    unreadCount: 0,
    updatedAt: '周一',
    online: true,
  },
]

const conversations = ref<Conversation[]>(
  props.initialConversations ? [...props.initialConversations] : defaultSampleConversations
)

const filteredConversations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return conversations.value
  return conversations.value.filter(
    (c) =>
      c.partyName.toLowerCase().includes(query) ||
      c.lastMessage.toLowerCase().includes(query)
  )
})

function openConversation(conv: Conversation) {
  conv.unreadCount = 0
  router.push(`/inbox/chat/${conv.id}`)
}

async function loadConversations() {
  if (props.initialConversations !== undefined) return
  try {
    const dmStore = useDMStore()
    await dmStore.reconcileFromServer()
    if (dmStore.conversations) {
      conversations.value = dmStore.conversations.map((c: any) => ({
        id: c.id || c.conversation_id,
        partyName: c.other_party?.display_name || c.other_username || '用户',
        avatar: c.other_party?.avatar_url || '',
        lastMessage: c.last_message_preview || c.preview || '',
        unreadCount: c.unread_count || 0,
        updatedAt: c.last_message_at
          ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
      }))
    }
  } catch {
    // Graceful fallback to defaultSampleConversations
  }
}

onMounted(() => {
  void loadConversations()
})
</script>

<style scoped>
.messages-mobile-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.messages-header {
  margin-bottom: 16px;
}

.messages-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.messages-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.messages-header__new-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  text-decoration: none;
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 4px;
  padding: 4px 10px;
}

.messages-header__search {
  margin-bottom: 4px;
}

.messages-content {
  display: flex;
  flex-direction: column;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.conversation-item:last-child {
  border-bottom: none;
}

.conversation-item:active {
  background-color: #f8fafc;
}

.conversation-item__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.conversation-item__online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: #16a34a;
  border: 1.5px solid #ffffff;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.conversation-item__time {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.conversation-item__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conversation-item__preview {
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-item__badge {
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--a-color-primary, #007aff);
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.messages-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.messages-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #f8fafc;
  color: var(--a-color-text-muted, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.messages-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.messages-empty__desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}

.messages-empty__btn {
  display: inline-block;
  padding: 8px 16px;
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}
</style>
