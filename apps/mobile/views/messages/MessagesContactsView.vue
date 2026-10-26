<template>
  <div class="messages-contacts-view">
    <!-- Header -->
    <header class="contacts-header">
      <div class="contacts-header__top">
        <h1 class="contacts-header__title">联系人</h1>
        <span class="contacts-header__count">{{ filteredContacts.length }} 位好友</span>
      </div>
      <p class="contacts-header__subtitle">关注的创作者与互关好友名录</p>

      <div class="contacts-header__search">
        <MInput
          v-model="searchQuery"
          placeholder="搜索好友姓名或简介..."
          clearable
        />
      </div>
    </header>

    <!-- Content -->
    <main class="contacts-content">
      <div v-if="filteredContacts.length > 0" class="contacts-list">
        <article
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="contact-item"
          data-testid="contact-item"
        >
          <div class="contact-item__avatar-wrap">
            <MAvatar :src="contact.avatar" :name="contact.name" :size="40" />
            <span v-if="contact.online" class="contact-item__online-dot" />
          </div>

          <div class="contact-item__info">
            <h2 class="contact-item__name">{{ contact.name }}</h2>
            <p v-if="contact.bio" class="contact-item__bio">{{ contact.bio }}</p>
          </div>

          <button
            type="button"
            class="contact-item__chat-btn"
            :data-testid="`contact-chat-btn-${contact.id}`"
            @click="startChat(contact.id)"
          >
            <MIcon name="messages" size="xs" />
            <span>发消息</span>
          </button>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="contacts-empty">
        <div class="contacts-empty__icon">
          <MIcon name="person" size="lg" />
        </div>
        <p class="contacts-empty__title">未找到联系人</p>
        <p class="contacts-empty__desc">去博客或动态空间关注感兴趣的创作者，建立联系。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import { useDMStore } from '@/stores/dm'

export interface ContactItem {
  id: string
  name: string
  bio?: string
  avatar?: string
  online?: boolean
}

const props = withDefaults(
  defineProps<{
    initialContacts?: ContactItem[]
  }>(),
  {
    initialContacts: undefined,
  }
)

const router = useRouter()
const dmStore = getActivePinia() ? useDMStore() : null
const searchQuery = ref('')

const contacts = ref<ContactItem[]>(
  props.initialContacts ? [...props.initialContacts] : []
)

watch(
  () => props.initialContacts,
  (newVal) => {
    if (newVal) {
      contacts.value = [...newVal]
    }
  },
  { deep: true }
)

watch(
  () => dmStore?.conversationsById,
  (convsById) => {
    if (!props.initialContacts && convsById) {
      const partyMap = new Map<string, ContactItem>()
      Object.values(convsById).forEach((c) => {
        if (c.other_party && !partyMap.has(c.other_party.id)) {
          partyMap.set(c.other_party.id, {
            id: c.other_party.id,
            name: c.other_party.display_name || '用户',
            avatar: c.other_party.avatar_url || '',
            bio: c.mailbox?.display_name ? `来自 ${c.mailbox.display_name}` : undefined,
          })
        }
      })
      if (partyMap.size > 0) {
        contacts.value = Array.from(partyMap.values())
      }
    }
  },
  { immediate: true }
)

const filteredContacts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return contacts.value
  return contacts.value.filter(
    (c) => c.name.toLowerCase().includes(query) || (c.bio && c.bio.toLowerCase().includes(query))
  )
})

function startChat(id: string) {
  router.push(`/inbox/chat/${id}`)
}

onMounted(() => {
  if (!props.initialContacts && dmStore) {
    void dmStore.reconcileFromServer?.().catch(() => {})
  }
})
</script>

<style scoped>
.messages-contacts-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.contacts-header {
  margin-bottom: 16px;
}

.contacts-header__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.contacts-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.contacts-header__count {
  font-size: 12px;
  color: var(--a-color-text-muted, #94a3b8);
}

.contacts-header__subtitle {
  margin: 4px 0 12px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.contacts-content {
  display: flex;
  flex-direction: column;
}

.contacts-list {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  transition: background-color 0.15s ease;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-item:active {
  background-color: #f8fafc;
}

.contact-item__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.contact-item__online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: #16a34a;
  border: 1.5px solid #ffffff;
}

.contact-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contact-item__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.contact-item__bio {
  margin: 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-item__chat-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  padding: 5px 10px;
  cursor: pointer;
  flex-shrink: 0;
}

.contact-item__chat-btn:active {
  background-color: #f1f5f9;
}

.contacts-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.contacts-empty__icon {
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

.contacts-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.contacts-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}
</style>
