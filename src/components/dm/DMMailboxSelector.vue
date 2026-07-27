<template>
  <label class="dm-mailbox-selector" data-testid="dm-mailbox-selector">
    <span class="sr-only">选择收件箱</span>
    <select :value="activeMailboxKey" @change="selectMailbox">
      <option v-for="mailbox in mailboxes" :key="keyFor(mailbox)" :value="keyFor(mailbox)">
        {{ labelFor(mailbox) }}{{ mailbox.unread_count ? ` (${mailbox.unread_count})` : '' }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import type { DMMailbox } from '@/api/dm'
import { mailboxKey } from '@/api/dm'

defineProps<{ mailboxes: DMMailbox[]; activeMailboxKey: string }>()
const emit = defineEmits<{ 'select-mailbox': [key: string] }>()
const keyFor = mailboxKey
const labelFor = (mailbox: DMMailbox) => mailbox.type === 'channel' ? `频道：${mailbox.display_name}` : '我的私信'
const selectMailbox = (event: Event) => emit('select-mailbox', (event.target as HTMLSelectElement).value)
</script>

<style scoped>
.dm-mailbox-selector select { width: 100%; min-height: 2.5rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-text); padding: 0 .7rem; font: inherit; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
</style>
