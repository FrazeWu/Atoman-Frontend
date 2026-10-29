<template>
  <PModal
    :show="safeLinkState.isOpen"
    title="访问外部站点"
    size="sm"
    modal-class="p-safe-link-modal"
    close-class="p-safe-link-modal__close"
    @close="closeSafeLink"
  >
    <div class="p-safe-link-modal__body">
      <p class="p-safe-link-modal__desc">
        你即将离开 Atoman 前往外部站点，请注意保护个人信息与安全。
      </p>

      <div class="p-safe-link-modal__card">
        <span class="p-safe-link-modal__host">{{ safeLinkState.targetHostname }}</span>
        <span class="p-safe-link-modal__url" :title="safeLinkState.targetUrl">{{ safeLinkState.targetUrl }}</span>
      </div>
    </div>

    <template #footer>
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
    </template>
  </PModal>
</template>

<script setup lang="ts">
import PModal from '@/components/ui/PModal.vue'
import { useSafeLink } from '@/composables/useSafeLink'

const { safeLinkState, closeSafeLink, proceedToSafeLink, copySafeLink } = useSafeLink()
</script>

<style scoped>
.p-safe-link-modal {
  max-width: 440px;
  box-shadow: none !important;
}

.p-safe-link-modal__body {
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
  width: 100%;
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
</style>
