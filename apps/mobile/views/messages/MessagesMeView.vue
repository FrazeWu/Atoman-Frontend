<template>
  <div class="messages-me-view">
    <!-- Unauthenticated Guest State -->
    <div v-if="authStore && !authStore.isAuthenticated" class="messages-me-guest-wrap">
      <MGuestCard
        title="登录查看消息档案"
        description="登录后可与创作者交流、接收系统通知并管理互动记录。"
        redirect="/inbox/me"
      />
    </div>

    <template v-else>
      <!-- Header -->
      <header class="messages-me-header">
        <h1 class="messages-me-title">消息设置</h1>
        <p class="messages-me-subtitle">管理即时私信、通知推送与隐私权限</p>
      </header>

      <!-- Stats Card -->
      <section class="messages-stats-card" data-testid="messages-stats-card">
        <div class="messages-stats-grid">
          <div class="messages-stat-item">
            <span class="messages-stat-item__value">{{ stats.unreadDMs }}</span>
            <span class="messages-stat-item__label">未读私信</span>
          </div>
          <div class="messages-stat-item">
            <span class="messages-stat-item__value">{{ stats.unreadNotifications }}</span>
            <span class="messages-stat-item__label">未读通知</span>
          </div>
          <div class="messages-stat-item">
            <span class="messages-stat-item__value">{{ stats.blacklistCount }}</span>
            <span class="messages-stat-item__label">黑名单</span>
          </div>
        </div>
      </section>

      <!-- Notification Preferences -->
      <section class="messages-settings-section">
        <h2 class="messages-settings-section__title">通知提醒</h2>
        <div class="messages-settings-card">
          <div class="messages-setting-row">
            <div class="messages-setting-row__info">
              <span class="messages-setting-row__label">消息免打扰</span>
              <span class="messages-setting-row__desc">开启后将不再接收桌面与移动端横幅振动提示</span>
            </div>
            <button
              type="button"
              class="messages-switch"
              :class="{ 'is-on': dndEnabled }"
              data-testid="dnd-toggle-btn"
              @click="dndEnabled = !dndEnabled"
            >
              <span class="messages-switch__handle" />
            </button>
          </div>

          <div class="messages-setting-row">
            <div class="messages-setting-row__info">
              <span class="messages-setting-row__label">系统公告推送</span>
              <span class="messages-setting-row__desc">接收平台功能迭代与版本升级通知</span>
            </div>
            <button
              type="button"
              class="messages-switch"
              :class="{ 'is-on': systemAnnounceEnabled }"
              @click="systemAnnounceEnabled = !systemAnnounceEnabled"
            >
              <span class="messages-switch__handle" />
            </button>
          </div>
        </div>
      </section>

      <!-- Privacy & Permissions -->
      <section class="messages-settings-section">
        <h2 class="messages-settings-section__title">隐私与权限</h2>
        <div class="messages-settings-card">
          <div class="messages-setting-row">
            <div class="messages-setting-row__info">
              <span class="messages-setting-row__label">谁可以发私信给我</span>
              <span class="messages-setting-row__desc">{{ dmPermissionLabel }}</span>
            </div>
            <button
              type="button"
              class="messages-setting-action-btn"
              @click="togglePermission"
            >
              切换权限
            </button>
          </div>

          <div class="messages-setting-row">
            <div class="messages-setting-row__info">
              <span class="messages-setting-row__label">黑名单用户</span>
              <span class="messages-setting-row__desc">已屏蔽 {{ stats.blacklistCount }} 位用户</span>
            </div>
            <span class="messages-setting-row__extra">管理</span>
          </div>
        </div>
      </section>

      <!-- Cleanup Actions -->
      <section class="messages-settings-section">
        <h2 class="messages-settings-section__title">数据与维护</h2>
        <div class="messages-settings-card">
          <div class="messages-setting-row" @click="clearReadCache">
            <div class="messages-setting-row__info">
              <span class="messages-setting-row__label">清理已读消息缓存</span>
              <span class="messages-setting-row__desc">释放本地储存，不影响云端历史</span>
            </div>
            <span class="messages-setting-row__extra">{{ clearedCache ? '已清理' : '立即清理' }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getActivePinia } from 'pinia'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useNotificationStore } from '@/stores/notification'
import { useUserBlocksStore } from '@/stores/userBlocks'

export interface MessagesStats {
  unreadDMs: number
  unreadNotifications: number
  blacklistCount: number
}

const props = withDefaults(
  defineProps<{
    initialStats?: MessagesStats
  }>(),
  {
    initialStats: undefined,
  }
)

const hasPinia = computed(() => Boolean(getActivePinia()))
const authStore = getActivePinia() ? useAuthStore() : null
const dmStore = getActivePinia() ? useDMStore() : null
const notifStore = getActivePinia() ? useNotificationStore() : null
let blocksStore: ReturnType<typeof useUserBlocksStore> | null = null
try {
  if (getActivePinia()) {
    blocksStore = useUserBlocksStore()
  }
} catch {
  // Graceful fallback
}

const defaultStats: MessagesStats = {
  unreadDMs: 2,
  unreadNotifications: 5,
  blacklistCount: 0,
}

const stats = ref<MessagesStats>(
  props.initialStats
    ? { ...props.initialStats }
    : {
        unreadDMs: dmStore?.dmUnread ?? defaultStats.unreadDMs,
        unreadNotifications: notifStore?.unreadCount ?? defaultStats.unreadNotifications,
        blacklistCount: blocksStore?.blockedUsers?.length ?? defaultStats.blacklistCount,
      }
)

watch(
  () => props.initialStats,
  (newVal) => {
    if (newVal) {
      stats.value = { ...newVal }
    }
  },
  { deep: true }
)

watch(
  [() => dmStore?.dmUnread, () => notifStore?.unreadCount, () => blocksStore?.blockedUsers?.length],
  ([dmUnread, notifUnread, blockedCount]) => {
    if (!props.initialStats) {
      stats.value = {
        unreadDMs: dmUnread ?? defaultStats.unreadDMs,
        unreadNotifications: notifUnread ?? defaultStats.unreadNotifications,
        blacklistCount: blockedCount ?? defaultStats.blacklistCount,
      }
    }
  },
  { immediate: true }
)

const dndEnabled = ref(false)
const systemAnnounceEnabled = ref(true)
const dmPermission = ref<'all' | 'following'>('all')
const clearedCache = ref(false)

const dmPermissionLabel = computed(() =>
  dmPermission.value === 'all' ? '所有人' : '仅我关注的人'
)

function togglePermission() {
  dmPermission.value = dmPermission.value === 'all' ? 'following' : 'all'
}

function clearReadCache() {
  clearedCache.value = true
  setTimeout(() => {
    clearedCache.value = false
  }, 2000)
}

onMounted(() => {
  if (authStore?.isAuthenticated && !props.initialStats) {
    void dmStore?.reconcileFromServer?.().catch(() => {})
    void notifStore?.fetchNotifications?.().catch(() => {})
  }
})
</script>

<style scoped>
.messages-me-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.messages-me-guest-wrap {
  padding-top: 16px;
}

.messages-me-header {
  margin-bottom: 2px;
}

.messages-me-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.messages-me-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

/* Stats Card */
.messages-stats-card {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 16px;
  box-shadow: none !important;
}

.messages-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.messages-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.messages-stat-item__value {
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.messages-stat-item__label {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
  margin-top: 2px;
}

/* Settings Sections */
.messages-settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.messages-settings-section__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.messages-settings-card {
  display: flex;
  flex-direction: column;
  background-color: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
}

.messages-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  transition: background-color 0.15s ease;
}

.messages-setting-row:last-child {
  border-bottom: none;
}

.messages-setting-row:active {
  background-color: #f8fafc;
}

.messages-setting-row__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.messages-setting-row__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.messages-setting-row__desc {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.messages-setting-row__extra {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
}

.messages-setting-action-btn {
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  padding: 4px 8px;
  cursor: pointer;
}

/* Switch */
.messages-switch {
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background-color: #e2e8f0;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s ease;
  padding: 2px;
  box-sizing: border-box;
}

.messages-switch.is-on {
  background-color: var(--a-color-text, #0f172a);
}

.messages-switch__handle {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--a-color-surface, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  transition: transform 0.2s ease;
  box-shadow: none !important;
}

.messages-switch.is-on .messages-switch__handle {
  transform: translateX(16px);
}
</style>
