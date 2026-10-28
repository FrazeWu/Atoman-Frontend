<template>
  <Teleport to="body">
    <Transition name="p-safe-modal-fade">
      <div
        v-if="safeLinkState.isOpen"
        class="p-safe-link-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safe-link-title"
        @click.self="closeSafeLink"
        @keydown.esc="closeSafeLink"
      >
        <div class="p-safe-link-modal">
          <div class="p-safe-link-modal__header">
            <h2 id="safe-link-title" class="p-safe-link-modal__title">访问外部站点</h2>
            <button
              type="button"
              class="p-safe-link-modal__close"
              aria-label="关闭"
              @click="closeSafeLink"
            >
              ✕
            </button>
          </div>

          <div class="p-safe-link-modal__body">
            <p class="p-safe-link-modal__desc">
              你即将离开 Atoman 前往外部站点，请注意保护个人信息与安全。
            </p>

            <div class="p-safe-link-modal__card">
              <span class="p-safe-link-modal__host">{{ safeLinkState.targetHostname }}</span>
              <span class="p-safe-link-modal__url" :title="safeLinkState.targetUrl">{{ safeLinkState.targetUrl }}</span>
            </div>
          </div>

          <div class="p-safe-link-modal__actions">
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--cancel"
              data-test="cancel-btn"
              @click="closeSafeLink"
            >
              取消
            </button>
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--copy"
              data-test="copy-btn"
              @click="copySafeLink"
            >
              复制链接
            </button>
            <button
              type="button"
              class="p-safe-link-modal__btn p-safe-link-modal__btn--proceed"
              data-test="proceed-btn"
              @click="proceedToSafeLink"
            >
              继续前往 ↗
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useSafeLink } from '@/composables/useSafeLink'

const { safeLinkState, closeSafeLink, proceedToSafeLink, copySafeLink } = useSafeLink()
</script>

<style scoped>
.p-safe-link-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.p-safe-link-modal {
  width: 100%;
  max-width: 440px;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.p-safe-link-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-safe-link-modal__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #64748b);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
}

.p-safe-link-modal__close:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.p-safe-link-modal__desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
}

.p-safe-link-modal__card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.p-safe-link-modal__host {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  word-break: break-all;
}

.p-safe-link-modal__url {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-safe-link-modal__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-safe-link-modal__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4375rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.p-safe-link-modal__btn--cancel {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: transparent;
  color: var(--a-color-text-secondary, #64748b);
}

.p-safe-link-modal__btn--cancel:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__btn--copy {
  border: 1px solid var(--a-color-border, #cbd5e1);
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
}

.p-safe-link-modal__btn--copy:hover {
  background: var(--a-color-surface-muted, #f1f5f9);
}

.p-safe-link-modal__btn--proceed {
  border: 1px solid var(--a-color-text, #0f172a);
  background: var(--a-color-text, #0f172a);
  color: var(--a-color-bg, #ffffff);
}

.p-safe-link-modal__btn--proceed:hover {
  opacity: 0.9;
}

.p-safe-modal-fade-enter-active,
.p-safe-modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.p-safe-modal-fade-enter-from,
.p-safe-modal-fade-leave-to {
  opacity: 0;
}
</style>
