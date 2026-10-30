<template>
  <aside class="dm-profile-drawer" data-testid="dm-profile-drawer" aria-label="联系人信息">
    <!-- 顶部抽屉标题栏 -->
    <header class="dm-profile-drawer__header">
      <h3 class="dm-profile-drawer__title">联系人信息</h3>
      <button
        type="button"
        class="dm-profile-drawer__close-btn"
        data-testid="dm-drawer-close-btn"
        aria-label="关闭"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </header>

    <div class="dm-profile-drawer__body">
      <!-- 核心名片区 -->
      <div class="dm-profile-drawer__card">
        <div class="dm-profile-drawer__avatar-wrapper">
          <img
            v-if="party.avatar_url"
            :src="party.avatar_url"
            :alt="party.display_name"
            class="dm-profile-drawer__avatar dm-drawer-avatar"
          />
          <span
            v-else
            class="dm-profile-drawer__avatar-fallback dm-drawer-avatar-fallback"
            data-testid="dm-drawer-avatar-fallback"
          >
            {{ monogram }}
          </span>
        </div>

        <h4 class="dm-profile-drawer__name">{{ party.display_name }}</h4>

        <div class="dm-profile-drawer__meta">
          <span class="dm-profile-drawer__badge" data-testid="dm-drawer-type-badge">
            {{ partyTypeLabel }}
          </span>
          <span class="dm-profile-drawer__id" data-testid="dm-drawer-id">
            @{{ party.id }}
          </span>
        </div>
      </div>

      <!-- 操作列表区 -->
      <div class="dm-profile-drawer__actions">
        <!-- 查看个人主页 / 频道主页 -->
        <RouterLink
          :to="profilePath"
          class="dm-profile-drawer__action-item"
        >
          <span class="dm-profile-drawer__action-icon">
            <User :size="16" />
          </span>
          <span class="dm-profile-drawer__action-label">{{ profileActionText }}</span>
          <ExternalLink :size="14" class="dm-profile-drawer__action-trailing" />
        </RouterLink>

        <!-- 拉黑 / 取消拉黑 -->
        <button
          type="button"
          class="dm-profile-drawer__action-item"
          :class="{ 'dm-profile-drawer__action-item--danger': !isBlocked }"
          data-testid="dm-drawer-block-btn"
          @click="onToggleBlock"
        >
          <span class="dm-profile-drawer__action-icon">
            <Ban :size="16" />
          </span>
          <span class="dm-profile-drawer__action-label">
            {{ isBlocked ? '取消拉黑' : '拉黑' }}
          </span>
        </button>

        <!-- 举报 -->
        <button
          type="button"
          class="dm-profile-drawer__action-item dm-profile-drawer__action-item--muted"
          data-testid="dm-drawer-report-btn"
          @click="emit('report')"
        >
          <span class="dm-profile-drawer__action-icon">
            <Flag :size="16" />
          </span>
          <span class="dm-profile-drawer__action-label">举报</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { X, User, ExternalLink, Ban, Flag } from 'lucide-vue-next'
import type { DMParty, DMConversation } from '@/api/dm'

const props = defineProps<{
  party: DMParty
  conversation?: DMConversation | null
}>()

const emit = defineEmits<{
  close: []
  block: []
  unblock: []
  report: []
}>()

const isBlocked = computed(() => !!props.conversation?.blocked)

const monogram = computed(() => {
  const trimmed = props.party.display_name?.trim()
  if (!trimmed) return '?'
  return (Array.from(trimmed)[0] || '?').toUpperCase()
})

const partyTypeLabel = computed(() => {
  return props.party.type === 'channel' ? '频道' : '个人用户'
})

const profileActionText = computed(() => {
  return props.party.type === 'channel' ? '查看频道主页' : '查看个人主页'
})

const profilePath = computed(() => {
  if (props.party.type === 'channel') {
    return `/channels/${encodeURIComponent(props.party.id)}`
  }
  return `/profile/${encodeURIComponent(props.party.id)}`
})

const onToggleBlock = () => {
  if (isBlocked.value) {
    emit('unblock')
  } else {
    emit('block')
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.defaultPrevented) return
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.dm-profile-drawer {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
  border-left: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
  box-sizing: border-box;
}

.dm-profile-drawer__header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--a-color-border-soft);
  box-sizing: border-box;
}

.dm-profile-drawer__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--a-color-text);
}

.dm-profile-drawer__close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color var(--a-motion-micro, 140ms) ease,
              background-color var(--a-motion-micro, 140ms) ease;
}

.dm-profile-drawer__close-btn:hover {
  color: var(--a-color-text);
  background-color: var(--a-color-surface-muted);
}

.dm-profile-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dm-profile-drawer__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.dm-profile-drawer__avatar-wrapper {
  margin-bottom: 12px;
}

.dm-profile-drawer__avatar {
  width: 64px;
  height: 64px;
  border-radius: var(--a-radius-control, 4px);
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  display: block;
}

.dm-profile-drawer__avatar-fallback {
  width: 64px;
  height: 64px;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
}

.dm-profile-drawer__name {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--a-color-text);
  word-break: break-all;
}

.dm-profile-drawer__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dm-profile-drawer__badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  border: 1px solid var(--a-color-border-soft);
}

.dm-profile-drawer__id {
  font-size: 0.8rem;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-muted);
}

.dm-profile-drawer__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dm-profile-drawer__action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--a-color-text);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  transition: color var(--a-motion-micro, 140ms) ease,
              background-color var(--a-motion-micro, 140ms) ease,
              border-color var(--a-motion-micro, 140ms) ease;
}

.dm-profile-drawer__action-item:hover {
  background-color: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.dm-profile-drawer__action-item--danger {
  color: var(--a-color-danger);
}

.dm-profile-drawer__action-item--danger:hover {
  background-color: color-mix(in srgb, var(--a-color-danger) 8%);
  color: var(--a-color-danger);
}

.dm-profile-drawer__action-item--muted {
  color: var(--a-color-text-secondary);
}

.dm-profile-drawer__action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dm-profile-drawer__action-label {
  flex: 1;
}

.dm-profile-drawer__action-trailing {
  color: var(--a-color-muted);
}
</style>
