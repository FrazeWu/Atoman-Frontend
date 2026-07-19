<template>
  <article class="debate-node" :class="{ 'debate-node--root': data.root }">
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
  </article>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

import type { DebateFlowNodeData } from './debateGraph'

defineProps<{ data: DebateFlowNodeData }>()
</script>

<style scoped>
.debate-node {
  width: 240px;
  min-height: 132px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.debate-node:hover {
  border-color: var(--a-color-border);
  box-shadow: 0 4px 12px rgb(15 23 42 / 8%);
}

.debate-node--root {
  border-color: var(--a-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-color-primary) 12%, transparent);
}

.debate-node__link {
  display: grid;
  min-height: 130px;
  padding: 14px;
  color: inherit;
  text-decoration: none;
}

.debate-node__link:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 3px;
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
  background: #eff6ff;
  color: #2563eb;
}

.debate-node__stamp--no {
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface-muted);
  color: #475569;
}

.debate-node h3 {
  align-self: center;
  margin: 10px 0;
  overflow-wrap: anywhere;
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

@media (prefers-reduced-motion: reduce) {
  .debate-node { transition: none; }
}
</style>
