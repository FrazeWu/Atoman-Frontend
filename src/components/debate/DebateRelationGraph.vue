<template>
  <div class="debate-flow" :aria-busy="loading">
    <div v-if="loading" class="debate-flow__state">加载中...</div>
    <div v-else-if="error" class="debate-flow__state debate-flow__state--error" role="alert">
      <span>关系加载失败</span>
      <button type="button" aria-label="重试加载关系" @click="emit('retry')">
        <RefreshCw :size="15" aria-hidden="true" />
        重试
      </button>
    </div>
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
      :aria-label="canvasLabel"
    >
      <Background pattern-color="var(--a-color-border-soft)" :gap="20" :size="1" />
      <Controls :show-interactive="false" position="bottom-right" />
      <template #node-debate="nodeProps">
        <DebateGraphNode :data="nodeProps.data" @expand="emit('expand', $event)" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import { RefreshCw } from 'lucide-vue-next'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import type { DebateGraph } from '@/types'
import DebateGraphNode from './DebateGraphNode.vue'
import { buildDebateFlow, type DebateRelationView } from './debateGraph'

const props = withDefaults(defineProps<{
  graph?: DebateGraph | null
  loading?: boolean
  error?: boolean
  view: DebateRelationView
  expandingNodeIds?: readonly string[]
}>(), {
  graph: null,
  loading: false,
  error: false,
  expandingNodeIds: () => [],
})

const emit = defineEmits<{
  expand: [nodeId: string]
  retry: []
}>()
const canvasLabel = computed(() => props.view === 'tree' ? '辩论树画布' : '辩论关系图画布')
const flow = computed(() => props.graph
  ? buildDebateFlow(props.graph, {
      view: props.view,
      expandingNodeIds: props.expandingNodeIds,
    })
  : { nodes: [], edges: [] })
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
.debate-flow__state--error { align-content: center; gap: 12px; }

.debate-flow__state--error button {
  display: inline-flex;
  min-width: 88px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
}

.debate-flow__state--error button:hover { background: var(--a-color-surface-muted); }
.debate-flow__state--error button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }

.debate-flow :deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  box-shadow: none;
}

.debate-flow :deep(.vue-flow__controls-button) {
  width: 44px;
  height: 44px;
  border-bottom-color: var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
}

.debate-flow :deep(.vue-flow__edge-textbg) { fill: var(--a-color-surface); }

@media (max-width: 640px) {
  .debate-flow { height: 640px; min-height: 560px; }
  .debate-flow :deep(.vue-flow__controls) { display: flex; flex-direction: row; }
  .debate-flow :deep(.vue-flow__controls-button) {
    border-right: 1px solid var(--a-color-border-soft);
    border-bottom: 0;
  }
  .debate-flow :deep(.vue-flow__controls-button:last-child) { border-right: 0; }
}
</style>
