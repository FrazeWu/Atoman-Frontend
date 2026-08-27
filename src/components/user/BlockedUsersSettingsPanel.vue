<template>
  <section class="blocked-users-settings">
    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>已拉黑用户</strong>
        <small>被拉黑的用户无法向你发送私信或与你互动。</small>
      </div>
      <div class="settings-block__control settings-block__control--form">
        <div v-if="loading" class="blocked-users__state" role="status">正在加载拉黑列表...</div>
        <div v-else-if="error" class="blocked-users__state blocked-users__state--error" role="alert">
          <span>{{ error }}</span>
          <PButton type="button" variant="secondary" size="sm" @click="load">重试</PButton>
        </div>
        <div v-else-if="!userBlocksStore.blockedUsers.length" class="blocked-users__state a-muted text-sm">暂无拉黑用户</div>
        <ul v-else class="blocked-users__list">
          <li v-for="item in userBlocksStore.blockedUsers" :key="item.id">
            <span>{{ item.blocked?.display_name || item.blocked?.username || item.blocked_id }}</span>
            <PButton
              type="button"
              variant="secondary"
              size="sm"
              :loading="unblockingId === item.blocked_id"
              :disabled="Boolean(unblockingId)"
              @click="unblock(item.blocked_id)"
            >
              取消拉黑
            </PButton>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import { useUserBlocksStore } from '@/stores/userBlocks'

const userBlocksStore = useUserBlocksStore()
const loading = ref(true)
const error = ref('')
const unblockingId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await userBlocksStore.fetchBlockedUsers()
  } catch {
    error.value = '拉黑列表加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function unblock(id: string) {
  if (unblockingId.value) return
  unblockingId.value = id
  error.value = ''
  try {
    await userBlocksStore.unblockUser(id)
  } catch {
    error.value = '取消拉黑失败，请重试'
  } finally {
    unblockingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.blocked-users-settings {
  display: grid;
  gap: 0.75rem;
}

.blocked-users__state {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
}

.blocked-users__state--error {
  color: var(--a-color-accent-destructive);
}

.blocked-users__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blocked-users__list li {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.blocked-users__list li:last-child {
  border-bottom: 0;
}
</style>
