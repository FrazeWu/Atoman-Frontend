<template>
  <article
    class="debate-node"
    :class="{
      'debate-node--root': data.root,
      'debate-node--expandable': data.expandable,
    }"
  >
    <Handle id="top-target" type="target" :position="Position.Top" class="debate-node__handle" />
    <Handle id="top-source" type="source" :position="Position.Top" class="debate-node__handle" />
    <Handle id="bottom-target" type="target" :position="Position.Bottom" class="debate-node__handle" />
    <Handle id="bottom-source" type="source" :position="Position.Bottom" class="debate-node__handle" />

    <RouterLink :to="`/debate/${data.debate.id}`" class="debate-node__link">
      <header class="debate-node__header">
        <span class="debate-node__kind">{{ data.root ? '当前辩题' : '辩题' }}</span>
        <span
          v-if="data.debate.conclusion_type === 'yes' || data.debate.conclusion_type === 'no'"
          class="debate-node__stamp"
          :class="`debate-node__stamp--${data.debate.conclusion_type}`"
        >
          结论 · {{ data.debate.conclusion_type === 'yes' ? '是' : '否' }}
        </span>
      </header>
      <h3>{{ data.debate.title }}</h3>
      <footer class="debate-node__meta">
        <span>{{ data.debate.user?.display_name || data.debate.user?.username || '匿名' }}</span>
        <span v-if="data.debate.tags?.[0]">{{ data.debate.tags[0] }}</span>
      </footer>
    </RouterLink>

    <button
      v-if="data.expandable"
      type="button"
      class="debate-node__expand"
      aria-label="继续展开"
      :aria-busy="data.expanding"
      :disabled="data.expanding"
      @click.stop.prevent="emit('expand', data.debate.id)"
    >
      <LoaderCircle v-if="data.expanding" :size="15" class="debate-node__spinner" aria-hidden="true" />
      <ChevronDown v-else :size="15" aria-hidden="true" />
      {{ data.expanding ? '展开中' : '继续展开' }}
    </button>
  </article>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { ChevronDown, LoaderCircle } from 'lucide-vue-next'

import type { DebateFlowNodeData } from './debateGraph'

defineProps<{ data: DebateFlowNodeData }>()
const emit = defineEmits<{ expand: [nodeId: string] }>()
</script>

<style scoped>
.debate-node {
  position: relative;
  box-sizing: border-box;
  width: 240px;
  height: 132px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  transition: border-color 180ms ease;
}

.debate-node:hover {
  border-color: var(--a-color-border);
}

.debate-node--root {
  border-color: var(--a-color-primary);
}

.debate-node__link {
  display: grid;
  box-sizing: border-box;
  height: 130px;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: 14px;
  color: inherit;
  text-decoration: none;
}

.debate-node--expandable .debate-node__link { padding-bottom: 45px; }

.debate-node__link:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -3px;
  border-radius: var(--a-radius-card);
}

.debate-node__header,
.debate-node__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.debate-node__kind {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--a-color-muted-soft);
  font-size: 10px;
}

.debate-node__kind::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--a-color-primary);
  content: '';
}

.debate-node__stamp {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.debate-node__stamp--yes {
  background: color-mix(in srgb, var(--a-color-success) 10%, var(--a-color-bg));
  color: var(--a-color-success);
}

.debate-node__stamp--no {
  border: 1px solid color-mix(in srgb, var(--a-color-danger) 30%, var(--a-color-border-soft));
  background: color-mix(in srgb, var(--a-color-danger) 8%, var(--a-color-bg));
  color: var(--a-color-danger);
}

.debate-node h3 {
  align-self: center;
  margin: 10px 0;
  display: -webkit-box;
  overflow-wrap: anywhere;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: 0;
}

.debate-node__meta {
  align-self: end;
  color: var(--a-color-muted-soft);
  font-size: 10px;
}

.debate-node__handle {
  width: 1px;
  height: 1px;
  border: 0;
  opacity: 0;
}

.debate-node__expand {
  position: absolute;
  z-index: 1;
  bottom: 0;
  left: 0;
  display: inline-flex;
  width: 100%;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.debate-node__expand:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.debate-node__expand:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -3px;
}

.debate-node__expand:disabled {
  color: var(--a-color-muted);
  cursor: wait;
}

.debate-node__spinner { animation: debate-node-spin 900ms linear infinite; }

@keyframes debate-node-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .debate-node { transition: none; }
  .debate-node__spinner { animation: none; }
}
</style>
