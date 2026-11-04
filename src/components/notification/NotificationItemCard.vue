<template>
  <div
    class="notification-item-card stream-card sidebar-item"
    :class="{
      'notification-item-card--compact': compact,
      'notification-item-card--unread unread': !notification.read_at,
      'notification-item-card--active selected': active,
      'notification-item-card--expanded is-expanded': isExpanded,
      'notification-item-card--system': isSystemNotification,
      'notification-item-card--collaboration': isCollaborationNotification,
    }"
    role="button"
    tabindex="0"
    @click="onClickCard"
    @keydown.enter="onClickCard"
    @keydown.space.prevent="onClickCard"
  >
    <!-- Standout Kicker Header Row (Non-compact only) -->
    <div v-if="!compact" class="card-kicker-row">
      <div class="card-kicker-group">
        <span class="card-kicker">{{ kickerText }}</span>
        <span v-if="isCollaborationNotification" class="card-badge-collab">待处理</span>
      </div>
      <div class="card-meta">
        <time class="card-time sidebar-item-time detail-time">{{ timeAgo }}</time>
        <span
          v-if="!notification.read_at"
          class="card-unread-dot"
          data-test="unread-dot"
          aria-label="未读"
        />
        <button
          type="button"
          class="card-expand-btn"
          :aria-expanded="isExpanded"
          aria-label="展开或收起详情"
          @click.stop="toggleExpand"
        >
          <ChevronDown
            :size="15"
            class="card-chevron-icon"
            :class="{ 'card-chevron-icon--rotated': isExpanded }"
          />
        </button>
      </div>
    </div>

    <!-- Main Row: Avatar + Content -->
    <div class="card-main-row">
      <!-- Avatar and Action Badge -->
      <div class="card-avatar-wrapper">
        <div v-if="isSystemNotification && !actorAvatar" class="card-system-avatar" title="系统通知">
          <ShieldAlert :size="compact ? 14 : 18" stroke-width="2" />
        </div>
        <PAvatar
          v-else
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
        <!-- Compact Header Row (Title alongside meta) -->
        <div v-if="compact" class="card-header-row">
          <div class="card-title-group">
            <span class="card-title sidebar-item-title">{{ title }}</span>
            <template v-if="sourceLabel">
              <span class="card-separator">·</span>
              <span class="card-source-label sidebar-item-source detail-source">{{ sourceLabel }}</span>
            </template>
            <span v-if="isCollaborationNotification" class="card-badge-collab">待处理</span>
          </div>
          <div class="card-meta">
            <time class="card-time sidebar-item-time detail-time">{{ timeAgo }}</time>
            <span
              v-if="!notification.read_at"
              class="card-unread-dot"
              data-test="unread-dot"
              aria-label="未读"
            />
          </div>
        </div>

        <!-- Non-compact Title Row -->
        <div v-else class="card-title-row">
          <div class="card-title-group">
            <span class="card-title sidebar-item-title">{{ title }}</span>
            <template v-if="sourceLabel">
              <span class="card-separator">·</span>
              <span class="card-source-label sidebar-item-source detail-source">{{ sourceLabel }}</span>
            </template>
          </div>
        </div>

        <!-- Context Quote Block (Non-compact only) -->
        <NotificationContextQuote
          v-if="!compact && hasQuote"
          :reply-excerpt="replyExcerpt"
          :original-excerpt="originalExcerpt"
          :text="quoteText"
          :expanded="isExpanded"
          class="card-quote"
        />

        <!-- Reason text if distinct from quote -->
        <p
          v-if="!compact && notification.reason && notification.reason !== quoteText"
          class="card-reason detail-reason"
        >
          {{ notification.reason }}
        </p>

        <!-- Body text if distinct from reason and quote -->
        <p
          v-if="!compact && notificationBody && notificationBody !== notification.reason && notificationBody !== quoteText"
          class="sidebar-item-body a-muted"
        >
          {{ notificationBody }}
        </p>

        <!-- Extended Meta Row (Non-compact expanded only) -->
        <div v-if="!compact && isExpanded" class="card-meta-extended">
          <span class="card-meta-full-time">{{ fullDateTime }}</span>
          <span class="card-meta-separator">·</span>
          <span class="card-meta-type">{{ sourceTypeLabel }}</span>
        </div>

        <!-- Action Row (Non-compact only) -->
        <div v-if="!compact" class="card-actions-row detail-actions" @click.stop @keydown.stop>
          <div class="card-actions-left">
            <PButton
              v-if="targetPath"
              variant="secondary"
              size="sm"
              class="card-action-btn"
              data-test="action-jump"
              @click="onJump"
            >
              前往来源内容
            </PButton>
            <PButton
              v-else
              variant="secondary"
              size="sm"
              disabled
              class="card-action-unavailable-btn detail-source"
            >
              来源已不可用
            </PButton>
          </div>

          <div class="card-actions-right">
            <button
              v-if="!notification.read_at"
              type="button"
              class="card-btn card-btn--mark-read"
              data-test="action-mark-read"
              title="标为已读"
              @click.stop="onMarkRead"
            >
              <Check :size="14" />
              <span>已读</span>
            </button>

            <details class="card-more-menu" data-test="action-more" @click.stop>
              <summary class="card-btn card-btn--icon" aria-label="更多操作">
                <Ellipsis :size="16" />
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AtSign,
  Check,
  ChevronDown,
  Ellipsis,
  GitPullRequest,
  Heart,
  MessageSquare,
  ShieldAlert,
} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import NotificationContextQuote from '@/components/notification/NotificationContextQuote.vue'
import type { Notification } from '@/types'
import {
  formatNotificationBody,
  formatNotificationTime,
  formatNotificationTitle,
  notificationActionType,
  notificationSourceLabel,
  notificationTargetPath,
} from '@/utils/notificationHelpers'

const props = withDefaults(
  defineProps<{
    notification: Notification
    compact?: boolean
    active?: boolean
    expanded?: boolean
  }>(),
  {
    compact: false,
    active: false,
    expanded: undefined,
  }
)

const emit = defineEmits<{
  'click': [id: string]
  'mark-read': [id: string]
  'jump': [notification: Notification]
  'mute-type': [notification: Notification]
  'mute-source': [notification: Notification]
  'toggle-expand': [expanded: boolean]
}>()

const isExpandedInternal = ref(props.expanded ?? false)
watch(() => props.expanded, (newVal) => {
  if (newVal !== undefined) isExpandedInternal.value = newVal
})

const isExpanded = computed({
  get: () => isExpandedInternal.value,
  set: (val: boolean) => {
    isExpandedInternal.value = val
    emit('toggle-expand', val)
  },
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const isSystemNotification = computed(() => actionType.value === 'system')
const isCollaborationNotification = computed(() => actionType.value === 'collaboration')

const fullDateTime = computed(() => {
  if (!props.notification.created_at) return '刚刚'
  const d = new Date(props.notification.created_at)
  return isNaN(d.getTime()) ? props.notification.created_at : d.toLocaleString('zh-CN', { hour12: false })
})

const sourceTypeLabel = computed(() => {
  switch (actionType.value) {
    case 'like': return '点赞互动'
    case 'reply': return '评论回复'
    case 'mention': return '内容提及'
    case 'forum': return '论坛动态'
    case 'collaboration': return '协作任务'
    case 'system': return '系统通知'
    default: return '系统通知'
  }
})

const kickerText = computed(() => {
  switch (actionType.value) {
    case 'like': return '互动 · 点赞'
    case 'reply': return '互动 · 回复'
    case 'mention': return '互动 · 提及'
    case 'forum': return '讨论动态'
    case 'collaboration': return '协作任务'
    case 'system': return '动态提醒'
    default: return '通知提醒'
  }
})

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
const targetPath = computed(() => notificationTargetPath(props.notification))
const notificationBody = computed(() => formatNotificationBody(props.notification))

const badgeIcon = computed(() => {
  switch (actionType.value) {
    case 'like':
      return Heart
    case 'reply':
    case 'forum':
      return MessageSquare
    case 'mention':
      return AtSign
    case 'collaboration':
      return GitPullRequest
    case 'system':
    default:
      return ShieldAlert
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
  if (props.notification.meta?.body) {
    return props.notification.meta.body as string
  }
  if (props.notification.reason) {
    return props.notification.reason
  }
  return ''
})

const hasQuote = computed(() => {
  return Boolean(replyExcerpt.value || originalExcerpt.value || quoteText.value)
})

const onClickCard = () => {
  emit('click', props.notification.id)
  if (!props.compact) {
    toggleExpand()
  }
}

const onJump = (e?: MouseEvent) => {
  e?.stopPropagation?.()
  emit('jump', props.notification)
}

const onMarkRead = (e?: MouseEvent) => {
  e?.stopPropagation?.()
  emit('mark-read', props.notification.id)
}

const onMuteType = (e?: MouseEvent) => {
  e?.stopPropagation?.()
  const target = e?.target as HTMLElement | undefined
  const details = target?.closest?.('details')
  if (details) details.removeAttribute('open')
  emit('mute-type', props.notification)
}

const onMuteSource = (e?: MouseEvent) => {
  e?.stopPropagation?.()
  const target = e?.target as HTMLElement | undefined
  const details = target?.closest?.('details')
  if (details) details.removeAttribute('open')
  emit('mute-source', props.notification)
}
</script>

<style scoped>
@import "./notificationItemCard.css";
</style>
