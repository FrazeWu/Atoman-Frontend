<template>
  <div class="dm-mailbox-selector" data-testid="dm-mailbox-selector">
    <label class="dm-mailbox-selector__wrapper">
      <span class="sr-only">选择收件箱</span>
      <span class="dm-mailbox-selector__icon" aria-hidden="true">
        <Inbox :size="15" />
      </span>
      <select
        :value="activeMailboxKey"
        class="dm-mailbox-selector__select"
        @change="selectMailbox"
      >
        <option
          v-for="mailbox in mailboxes"
          :key="keyFor(mailbox)"
          :value="keyFor(mailbox)"
        >
          {{ labelFor(mailbox) }}{{ mailbox.unread_count ? ` (${mailbox.unread_count})` : '' }}
        </option>
      </select>
      <ChevronDown
        class="dm-mailbox-selector__arrow"
        :size="14"
        aria-hidden="true"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, Inbox } from 'lucide-vue-next'
import type { DMMailbox } from '@/api/dm'
import { mailboxKey } from '@/api/dm'

defineProps<{ mailboxes: DMMailbox[]; activeMailboxKey: string }>()
const emit = defineEmits<{ 'select-mailbox': [key: string] }>()
const keyFor = mailboxKey
const labelFor = (mailbox: DMMailbox) => mailbox.type === 'channel' ? `频道：${mailbox.display_name}` : '我的私信'
const selectMailbox = (event: Event) => emit('select-mailbox', (event.target as HTMLSelectElement).value)
</script>

<style scoped>
.dm-mailbox-selector {
  width: 100%;
}

.dm-mailbox-selector__wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: color-mix(in srgb, var(--a-color-text) 5%, transparent);
  border: 1px solid transparent;
  border-radius: 4px;
  transition: background-color var(--a-motion-micro, 150ms) ease, border-color var(--a-motion-micro, 150ms) ease;
  box-shadow: none !important;
}

.dm-mailbox-selector__wrapper:hover {
  background: color-mix(in srgb, var(--a-color-text) 8%, transparent);
}

.dm-mailbox-selector__wrapper:focus-within {
  border-color: var(--a-color-primary);
  background: var(--a-color-bg);
  box-shadow: none !important;
}

.dm-mailbox-selector__icon {
  position: absolute;
  left: 0.75rem;
  display: flex;
  align-items: center;
  color: var(--a-color-muted);
  pointer-events: none;
}

.dm-mailbox-selector__select {
  width: 100%;
  height: 2.25rem;
  padding: 0 2rem 0 2.25rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--a-color-text);
  background: transparent;
  border: none;
  border-radius: 4px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  letter-spacing: -0.01em;
}

.dm-mailbox-selector__arrow {
  position: absolute;
  right: 0.75rem;
  color: var(--a-color-muted);
  pointer-events: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
