<template>
  <div class="messages-notifications-view">
    <!-- Header -->
    <header class="notifications-header">
      <div class="notifications-header__top">
        <div>
          <h1 class="notifications-header__title">通知</h1>
          <p class="notifications-header__subtitle">互动提醒、提及与系统消息</p>
        </div>
        <button
          type="button"
          class="notifications-header__mark-btn"
          data-testid="notifications-mark-read-btn"
          @click="markAllAsRead"
        >
          <MIcon name="check" size="xs" />
          <span>全部已读</span>
        </button>
      </div>

      <!-- Category Filter Chips -->
      <div class="notifications-chips">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="notifications-chip"
          :class="{ 'is-active': activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          {{ cat.label }}
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="notifications-content">
      <div v-if="filteredNotifications.length > 0" class="notifications-list">
        <article
          v-for="item in filteredNotifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'is-unread': !item.read }"
          data-testid="notification-item"
          @click="item.read = true"
        >
          <div class="notification-item__icon-wrap">
            <MIcon :name="getIconName(item.category)" size="sm" />
          </div>

          <div class="notification-item__body">
            <div class="notification-item__top">
              <span class="notification-item__title">{{ item.title }}</span>
              <span class="notification-item__time">{{ item.time }}</span>
            </div>
            <p v-if="item.content" class="notification-item__content">{{ item.content }}</p>
          </div>

          <span v-if="!item.read" class="notification-item__unread-dot" />
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="notifications-empty">
        <div class="notifications-empty__icon">
          <MIcon name="bell" size="lg" />
        </div>
        <p class="notifications-empty__title">暂无通知消息</p>
        <p class="notifications-empty__desc">当有新的回复、点赞或系统动态时，将在此汇总通知。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MIcon from '@mobile/components/ui/MIcon.vue'

export interface NotificationItem {
  id: string
  title: string
  category: 'reply' | 'like' | 'mention' | 'system' | string
  content?: string
  time: string
  read: boolean
}

const props = withDefaults(
  defineProps<{
    initialNotifications?: NotificationItem[]
  }>(),
  {
    initialNotifications: undefined,
  }
)

const defaultSampleNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Alice 赞了你的短笺',
    category: 'like',
    content: '“事物的本质并不因赞扬而改变。”',
    time: '10分钟前',
    read: false,
  },
  {
    id: 'n-2',
    title: 'Bob 在文章下回复了你',
    category: 'reply',
    content: '“同意，尤其在 TypeScript 中状态机的实现上非常优雅。”',
    time: '35分钟前',
    read: false,
  },
  {
    id: 'n-3',
    title: '系统公告：移动端体验升级',
    category: 'system',
    content: '移动端全空间纯白微圆角系统已全量上线，欢迎体验。',
    time: '2小时前',
    read: true,
  },
  {
    id: 'n-4',
    title: 'Elena Vance 在短笺中 @ 了你',
    category: 'mention',
    content: '来看看这份新的排版手稿 @Fraze',
    time: '昨天',
    read: true,
  },
]

const notifications = ref<NotificationItem[]>(
  props.initialNotifications ? [...props.initialNotifications] : defaultSampleNotifications
)

const categories = [
  { key: 'all', label: '全部' },
  { key: 'reply', label: '回复' },
  { key: 'like', label: '赞' },
  { key: 'system', label: '系统' },
]

const activeCategory = ref('all')

watch(
  () => props.initialNotifications,
  (newVal) => {
    if (newVal) {
      notifications.value = [...newVal]
    }
  },
  { deep: true }
)

const filteredNotifications = computed(() => {
  if (activeCategory.value === 'all') return notifications.value
  return notifications.value.filter((n) => n.category === activeCategory.value)
})

function markAllAsRead() {
  notifications.value = notifications.value.map((n) => ({ ...n, read: true }))
}

function getIconName(cat: string): string {
  if (cat === 'like') return 'heart'
  if (cat === 'reply' || cat === 'mention') return 'messages'
  return 'bell'
}
</script>

<style scoped>
.messages-notifications-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding: 16px 16px 96px;
  box-sizing: border-box;
}

.notifications-header {
  margin-bottom: 16px;
}

.notifications-header__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.notifications-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

.notifications-header__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.notifications-header__mark-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  padding: 5px 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.notifications-chips {
  display: flex;
  gap: 8px;
}

.notifications-chip {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.notifications-chip.is-active {
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  border-color: var(--a-color-text, #0f172a);
}

.notifications-content {
  display: flex;
  flex-direction: column;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  cursor: pointer;
  transition: background-color 0.15s ease;
  position: relative;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:active {
  background-color: #f8fafc;
}

.notification-item.is-unread {
  background-color: #fbfcfe;
}

.notification-item__icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: #f1f5f9;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #0f172a);
  flex-shrink: 0;
}

.notification-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notification-item__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.notification-item__time {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
  flex-shrink: 0;
}

.notification-item__content {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-item__unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #2563eb;
  position: absolute;
  top: 14px;
  right: 14px;
}

.notifications-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 20px;
}

.notifications-empty__icon {
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

.notifications-empty__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.notifications-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
  line-height: 1.5;
}
</style>
