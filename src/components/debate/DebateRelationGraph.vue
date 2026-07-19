<template>
  <div class="debate-flow" :aria-busy="loading">
    <div v-if="loading" class="debate-flow__state">加载中...</div>
    <div v-else-if="!graph?.nodes.length" class="debate-flow__state">暂无引用</div>
    <VueFlow
      v-else
      :nodes="flow.nodes"
      :edges="flow.edges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :zoom-on-double-click="false"
      :min-zoom="0.7"
      :max-zoom="1.6"
      fit-view-on-init
      class="debate-flow__canvas"
      aria-label="辩论关系图"
    >
      <Background pattern-color="#e2e8f0" :gap="20" :size="1" />
      <Controls :show-interactive="false" position="bottom-right" />
      <template #node-debate="nodeProps">
        <DebateGraphNode :data="nodeProps.data" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import type { DebateGraph } from '@/types'
import DebateGraphNode from './DebateGraphNode.vue'
import { buildDebateFlow } from './debateGraph'

const props = withDefaults(defineProps<{
  graph?: DebateGraph | null
  loading?: boolean
}>(), {
  graph: null,
  loading: false,
})

const flow = computed(() => props.graph ? buildDebateFlow(props.graph) : { nodes: [], edges: [] })
</script>

<style scoped>
.debate-flow {
  position: relative;
  min-width: 0;
  height: min(760px, 72vh);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.debate-flow__canvas { width: 100%; height: 100%; }
.debate-flow__state { display: grid; height: 100%; place-items: center; color: var(--a-color-muted); font-size: 14px; }

.debate-flow :deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  box-shadow: none;
}

.debate-flow :deep(.vue-flow__controls-button) {
  width: 40px;
  height: 40px;
  border-bottom-color: var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
}

.debate-flow :deep(.vue-flow__edge-textbg) { fill: var(--a-color-surface); }

@media (max-width: 640px) {
  .debate-flow { height: 640px; min-height: 560px; }
}
</style>
