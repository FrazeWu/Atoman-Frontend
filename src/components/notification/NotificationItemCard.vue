<template>
  <div
    class="notification-item-card"
    :class="{
      'notification-item-card--compact': compact,
      'notification-item-card--unread': !notification.read_at,
      'notification-item-card--active': active,
    }"
    role="button"
    tabindex="0"
    @click="onClickCard"
    @keydown.enter="onClickCard"
    @keydown.space.prevent="onClickCard"
  >
    <!-- Avatar and Action Badge -->
    <div class="card-avatar-wrapper">
      <PAvatar
        :src="actorAvatar"
        :name="actorName"
        :size="compact ? 'xs' : 'sm'"
        class="card-avatar"
      />
      <div
        class="card-action-badge"
        :class="`card-action-badge--${actionType}`"
        :data-test="`badge-${actionType}`"
        :title="badgeTitle"
      >
        <component :is="badgeIcon" :size="compact ? 10 : 12" stroke-width="2.5" />
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="card-content">
      <div class="card-header-row">
        <div class="card-title-group">
          <span class="card-title">{{ title }}</span>
          <span v-if="sourceLabel" class="card-source-label">· {{ sourceLabel }}</span>
        </div>
        <div class="card-meta">
          <time class="card-time">{{ timeAgo }}</time>
          <span
            v-if="!notification.read_at"
            class="card-unread-dot"
            data-test="unread-dot"
            aria-label="未读"
          />
        </div>
      </div>

      <!-- Context Quote Block (Non-compact only) -->
      <NotificationContextQuote
        v-if="!compact && hasQuote"
        :reply-excerpt="replyExcerpt"
        :original-excerpt="originalExcerpt"
        :text="quoteText"
        class="card-quote"
      />

      <!-- Action Row (Non-compact only) -->
      <div v-if="!compact" class="card-actions-row" @click.stop>
        <div class="card-actions-left" />
        <div class="card-actions-right">
          <button
            v-if="!notification.read_at"
            type="button"
            class="card-btn card-btn--mark-read"
            data-test="action-mark-read"
            title="标为已读"
            @click.stop="onMarkRead"
          >
            <IconCheck :size="14" />
            <span>已读</span>
          </button>

          <details class="card-more-menu" data-test="action-more" @click.stop>
            <summary class="card-btn card-btn--icon" aria-label="更多操作">
              <IconDots :size="16" />
            </summary>
            <div class="card-menu-dropdown" role="menu">
              <button
                type="button"
                class="card-menu-item"
                data-test="action-mute-type"
                @click="onMuteType"
              >
                不再提醒此类动态
              </button>
              <button
                type="button"
                class="card-menu-item"
                data-test="action-mute-source"
                @click="onMuteSource"
              >
                不再提醒此内容
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  IconAt,
  IconCheck,
  IconDots,
  IconGitPullRequest,
  IconHeart,
  IconMessage2,
  IconShieldExclamation,
} from '@tabler/icons-vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import NotificationContextQuote from '@/components/notification/NotificationContextQuote.vue'
import type { Notification } from '@/types'
import {
  formatNotificationTime,
  formatNotificationTitle,
  notificationActionType,
  notificationSourceLabel,
} from '@/utils/notificationHelpers'

const props = withDefaults(
  defineProps<{
    notification: Notification
    compact?: boolean
    active?: boolean
  }>(),
  {
    compact: false,
    active: false,
  }
)

const emit = defineEmits<{
  'click': [id: string]
  'mark-read': [id: string]
  'mute-type': [notification: Notification]
  'mute-source': [notification: Notification]
}>()

const actorName = computed(() => {
  return (
    props.notification.actor?.display_name ||
    props.notification.actor?.username ||
    '系统'
  )
})

const actorAvatar = computed(() => {
  return props.notification.actor?.avatar_url || ''
})

const title = computed(() => formatNotificationTitle(props.notification))
const sourceLabel = computed(() => notificationSourceLabel(props.notification))
const timeAgo = computed(() => formatNotificationTime(props.notification.created_at))
const actionType = computed(() => notificationActionType(props.notification))

const badgeIcon = computed(() => {
  switch (actionType.value) {
    case 'like':
      return IconHeart
    case 'reply':
    case 'forum':
      return IconMessage2
    case 'mention':
      return IconAt
    case 'collaboration':
      return IconGitPullRequest
    case 'system':
    default:
      return IconShieldExclamation
  }
})

const badgeTitle = computed(() => {
  switch (actionType.value) {
    case 'like':
      return '点赞'
    case 'reply':
      return '回复'
    case 'mention':
      return '提及'
    case 'collaboration':
      return '协作'
    case 'forum':
      return '论坛'
    case 'system':
    default:
      return '系统'
  }
})

const replyExcerpt = computed(() => {
  return (props.notification.meta?.reply_excerpt as string) || ''
})

const originalExcerpt = computed(() => {
  return (
    (props.notification.meta?.original_excerpt as string) ||
    (props.notification.meta?.root_comment_body as string) ||
    ''
  )
})

const quoteText = computed(() => {
  if (replyExcerpt.value || originalExcerpt.value) return ''
  if (props.notification.category === 'system' || props.notification.type === 'site_announcement') {
    return (props.notification.meta?.body as string) || ''
  }
  return ''
})

const hasQuote = computed(() => {
  return Boolean(replyExcerpt.value || originalExcerpt.value || quoteText.value)
})

const onClickCard = () => {
  emit('click', props.notification.id)
}

const onMarkRead = (e: MouseEvent) => {
  e.stopPropagation()
  emit('mark-read', props.notification.id)
}

const onMuteType = (e: MouseEvent) => {
  e.stopPropagation()
  // Close details menu if present
  const target = e.target as HTMLElement
  const details = target.closest('details')
  if (details) details.removeAttribute('open')
  emit('mute-type', props.notification)
}

const onMuteSource = (e: MouseEvent) => {
  e.stopPropagation()
  const target = e.target as HTMLElement
  const details = target.closest('details')
  if (details) details.removeAttribute('open')
  emit('mute-source', props.notification)
}
</script>

<style scoped>
.notification-item-card {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  user-select: none;
}

.notification-item-card:hover {
  border-color: var(--a-color-border);
}

.notification-item-card--active {
  border-color: var(--a-color-primary);
  background: var(--a-color-bg);
}

.notification-item-card--compact {
  padding: 0.5rem 0.75rem;
  gap: 0.625rem;
  border-radius: var(--a-radius-card, 4px);
}

/* Avatar & Badge */
.card-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
}

.card-action-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--a-color-bg, #ffffff);
  border: 1.5px solid var(--a-color-bg, #ffffff);
  box-shadow: var(--a-shadow-sm);
}

.card-action-badge--like {
  color: var(--a-color-danger, #ef4444);
}

.card-action-badge--reply,
.card-action-badge--forum {
  color: var(--a-color-primary, #2563eb);
}

.card-action-badge--mention {
  color: var(--a-color-success, #10b981);
}

.card-action-badge--collaboration {
  color: var(--a-color-warning, #f59e0b);
}

.card-action-badge--system {
  color: var(--a-color-blog, #166534);
}

/* Content Area */
.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.card-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.card-title-group {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
}

.card-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #111827);
  line-height: 1.4;
  word-break: break-word;
}

.card-source-label {
  font-size: 0.8125rem;
  color: var(--a-color-text-muted, #6b7280);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.card-time {
  font-size: 0.75rem;
  color: var(--a-color-text-muted, #9ca3af);
  white-space: nowrap;
}

.card-unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-primary, #2563eb);
  flex-shrink: 0;
}

/* Context Quote */
.card-quote {
  margin-top: 0.125rem;
}

/* Actions Row */
.card-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.card-actions-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #4b5563);
  background: transparent;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.card-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: var(--a-color-border);
}

.card-btn--icon {
  padding: 0.25rem;
  border: none;
  color: var(--a-color-text-muted);
}

.card-btn--icon:hover {
  color: var(--a-color-text);
}

/* More Menu Dropdown */
.card-more-menu {
  position: relative;
}

.card-more-menu summary {
  list-style: none;
}

.card-more-menu summary::-webkit-details-marker {
  display: none;
}

.card-menu-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 140px;
  padding: 0.25rem 0;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: var(--a-shadow-lg);
}

.card-menu-item {
  display: block;
  width: 100%;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: left;
  color: var(--a-color-text-secondary, #374151);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.card-menu-item:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
</style>
