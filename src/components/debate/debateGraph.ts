import dagre from '@dagrejs/dagre'
import { MarkerType, type Edge, type Node } from '@vue-flow/core'

import type { Debate, DebateGraph } from '@/types'

export interface DebateFlowNodeData extends Record<string, unknown> {
  debate: Debate
  root: boolean
}

export interface DebateFlowResult {
  nodes: Node<DebateFlowNodeData>[]
  edges: Edge[]
}

const nodeWidth = 240
const nodeHeight = 132

export function buildDebateFlow(graph: DebateGraph): DebateFlowResult {
  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 104, marginx: 32, marginy: 32 })

  const neighbors = new Map<string, string[]>()
  for (const node of graph.nodes) {
    layout.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    neighbors.set(node.id, [])
  }
  for (const relation of graph.relations) {
    neighbors.get(relation.source_debate_id)?.push(relation.target_debate_id)
    neighbors.get(relation.target_debate_id)?.push(relation.source_debate_id)
  }

  const visited = new Set([graph.root_id])
  const queue = [graph.root_id]
  while (queue.length) {
    const current = queue.shift()!
    for (const neighbor of neighbors.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
      layout.setEdge(current, neighbor)
    }
  }
  dagre.layout(layout)

  const nodes: Node<DebateFlowNodeData>[] = graph.nodes.map((debate) => {
    const position = layout.node(debate.id) ?? { x: nodeWidth / 2, y: nodeHeight / 2 }
    return {
      id: debate.id,
      type: 'debate',
      position: { x: position.x - nodeWidth / 2, y: position.y - nodeHeight / 2 },
      data: { debate, root: debate.id === graph.root_id },
      selectable: true,
      draggable: false,
    }
  })
  const positions = new Map(nodes.map((node) => [node.id, node.position]))
  const edges: Edge[] = graph.relations.map((relation) => {
    const sourceAbove = (positions.get(relation.source_debate_id)?.y ?? 0)
      < (positions.get(relation.target_debate_id)?.y ?? 0)
    const support = relation.stance === 'support'
    const color = support ? '#0d9488' : '#dc2626'
    return {
      id: relation.id,
      source: relation.source_debate_id,
      target: relation.target_debate_id,
      sourceHandle: sourceAbove ? 'bottom-source' : 'top-source',
      targetHandle: sourceAbove ? 'top-target' : 'bottom-target',
      type: 'smoothstep',
      label: support ? '支撑' : '反驳',
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: {
        stroke: color,
        strokeWidth: 2,
        ...(support ? {} : { strokeDasharray: '7 5' }),
      },
      labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.96 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
    }
  })

  return { nodes, edges }
}
