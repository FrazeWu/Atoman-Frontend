import dagre from '@dagrejs/dagre'
import { MarkerType, type Edge, type Node } from '@vue-flow/core'

import type { Debate, DebateGraph } from '@/types'

export interface DebateFlowNodeData extends Record<string, unknown> {
  debate: Debate
  root: boolean
  expandable: boolean
  expanding: boolean
}

export interface DebateFlowResult {
  nodes: Node<DebateFlowNodeData>[]
  edges: Edge[]
}

const nodeWidth = 240
const nodeHeight = 132

export type DebateRelationView = 'tree' | 'graph'

export interface BuildDebateFlowOptions {
  view: DebateRelationView
  expandingNodeIds?: readonly string[]
}

export function buildDebateFlow(
  graph: DebateGraph,
  options: BuildDebateFlowOptions,
): DebateFlowResult {
  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 104, marginx: 32, marginy: 32 })

  const candidateRelations = options.view === 'tree'
    ? graph.relations.filter(relation => relation.stance === 'support')
    : graph.relations
  const expandableNodeIds = new Set(graph.expandable_node_ids)
  const expandingNodeIds = new Set(options.expandingNodeIds ?? [])

  const relationNeighbors = new Map(graph.nodes.map(node => [node.id, [] as string[]]))
  for (const relation of candidateRelations) {
    relationNeighbors.get(relation.source_debate_id)?.push(relation.target_debate_id)
    relationNeighbors.get(relation.target_debate_id)?.push(relation.source_debate_id)
  }

  const visibleNodeIds = options.view === 'graph'
    ? new Set(graph.nodes.map(node => node.id))
    : new Set([graph.root_id])
  if (options.view === 'tree') {
    const queue = [graph.root_id]
    while (queue.length) {
      const current = queue.shift()!
      for (const neighbor of relationNeighbors.get(current) ?? []) {
        if (visibleNodeIds.has(neighbor)) continue
        visibleNodeIds.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  const debates = graph.nodes.filter(node => visibleNodeIds.has(node.id))
  const relations = candidateRelations.filter(relation => (
    visibleNodeIds.has(relation.source_debate_id)
    && visibleNodeIds.has(relation.target_debate_id)
  ))
  const neighbors = new Map<string, string[]>()
  for (const node of debates) {
    layout.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    neighbors.set(node.id, [])
  }
  for (const relation of relations) {
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

  const nodes: Node<DebateFlowNodeData>[] = debates.map((debate) => {
    const position = layout.node(debate.id) ?? { x: nodeWidth / 2, y: nodeHeight / 2 }
    return {
      id: debate.id,
      type: 'debate',
      position: { x: position.x - nodeWidth / 2, y: position.y - nodeHeight / 2 },
      data: {
        debate,
        root: debate.id === graph.root_id,
        expandable: expandableNodeIds.has(debate.id),
        expanding: expandingNodeIds.has(debate.id),
      },
      selectable: true,
      draggable: false,
      connectable: false,
    }
  })
  const positions = new Map(nodes.map((node) => [node.id, node.position]))
  const edges: Edge[] = relations.map((relation) => {
    const sourceAbove = (positions.get(relation.source_debate_id)?.y ?? 0)
      < (positions.get(relation.target_debate_id)?.y ?? 0)
    const support = relation.stance === 'support'
    const color = support ? 'var(--a-color-success)' : 'var(--a-color-danger)'
    return {
      id: relation.id,
      source: relation.source_debate_id,
      target: relation.target_debate_id,
      sourceHandle: sourceAbove ? 'bottom-source' : 'top-source',
      targetHandle: sourceAbove ? 'top-target' : 'bottom-target',
      type: 'smoothstep',
      label: support ? '支撑' : '反驳',
      data: { stance: relation.stance },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: {
        stroke: color,
        strokeWidth: 2,
        ...(support ? {} : { strokeDasharray: '7 5' }),
      },
      labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: 'var(--a-color-surface)', fillOpacity: 0.96 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
    }
  })

  return { nodes, edges }
}
