<template>
  <Teleport to="body" :disabled="!teleport">
    <div v-if="open" class="mobile-space-drawer-root">
      <!-- Backdrop -->
      <div
        class="mobile-space-drawer__backdrop"
        data-testid="drawer-backdrop"
        aria-hidden="true"
        @click="handleClose"
      />

      <!-- Drawer Panel -->
      <aside
        class="mobile-space-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="空间导航抽屉"
      >
        <!-- Header -->
        <div class="mobile-space-drawer__header">
          <span class="mobile-space-drawer__brand">ATOMAN SPACES</span>
          <button
            type="button"
            class="mobile-space-drawer__close"
            data-testid="drawer-close"
            aria-label="关闭抽屉"
            @click="handleClose"
          >
            <MIcon name="xmark" size="sm" :stroke-width="1.8" />
          </button>
        </div>

        <!-- Space List -->
        <nav class="mobile-space-drawer__nav" aria-label="空间列表">
          <button
            v-for="space in spaces"
            :key="space.key"
            type="button"
            class="mobile-space-drawer__item"
            :class="{ 'is-active': space.key === currentSpace }"
            :data-space-key="space.key"
            data-testid="space-item"
            @click="handleSelect(space.key)"
          >
            <span class="mobile-space-drawer__item-icon">
              <MIcon :name="space.icon" size="md" :stroke-width="space.key === currentSpace ? 2.0 : 1.6" />
            </span>
            <span class="mobile-space-drawer__item-name">{{ space.name }}</span>
            <span v-if="space.badge" class="mobile-space-drawer__item-badge">
              {{ space.badge }}
            </span>
          </button>
        </nav>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import MIcon from '@mobile/components/ui/MIcon.vue'
import { ATOMAN_SPACES, type SpaceDefinition } from './spaceConstants'

const props = withDefaults(
  defineProps<{
    open: boolean
    currentSpace?: string
    teleport?: boolean
    spaces?: SpaceDefinition[]
  }>(),
  {
    currentSpace: 'global',
    teleport: false,
    spaces: () => ATOMAN_SPACES,
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'select-space', spaceKey: string): void
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('update:open', false)
  emit('close')
}

const handleSelect = (spaceKey: string) => {
  emit('select-space', spaceKey)
  emit('update:open', false)
  emit('close')
}
</script>

<style scoped>
.mobile-space-drawer-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
}

.mobile-space-drawer__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-space-drawer {
  position: relative;
  z-index: 1001;
  width: 280px;
  max-width: 80vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-right: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: none;
  animation: slideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-space-drawer__header {
  height: calc(52px + env(safe-area-inset-top, 0px));
  min-height: calc(52px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: 16px;
  padding-bottom: 0;
  padding-left: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.mobile-space-drawer__brand {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--a-color-muted, #64748b);
  text-transform: uppercase;
}

.mobile-space-drawer__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mobile-space-drawer__close:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-fg, #0f172a);
}

.mobile-space-drawer__nav {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-space-drawer__item {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-card, 4px);
  color: var(--a-color-text, #1e293b);
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.mobile-space-drawer__item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.mobile-space-drawer__item.is-active {
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-color: var(--a-color-border-soft, #e2e8f0);
  color: var(--a-color-primary, #0066cc);
  font-weight: 600;
}

.mobile-space-drawer__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.mobile-space-drawer__item-name {
  flex: 1;
}

.mobile-space-drawer__item-badge {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--a-color-muted, #64748b);
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 4px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
</style>
