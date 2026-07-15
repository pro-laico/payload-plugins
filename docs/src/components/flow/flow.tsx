'use client'

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FlowTile, type TileData } from './flow-tile'

/**
 * Process-flow diagram for "how it works" pages — React Flow (@xyflow/react) as a read-only
 * canvas: structure is locked, but viewers can pan (drag), pinch/double-click zoom, and use the
 * corner controls; the mouse wheel stays with page scroll. Data-driven from MDX: `export const nodes/edges = [...]` and render
 * `<Flow nodes={nodes} edges={edges} />`. Positions are hand-placed x/y coordinates (tiles are
 * 224px wide; ~110-150px vertical rhythm, ≥180px below tiles that carry a `detail` line);
 * `fitView` scales the graph to the box.
 *
 * Branch edges off a `check` tile must exit the sides (`fromSide: 'left'` / `'right'`) — two
 * edges leaving the same bottom handle overlap and their yes/no labels pile up at the junction.
 */
export interface FlowNode extends TileData {
  x: number
  y: number
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
  dashed?: boolean
  /** Attach to a specific side of the source/target tile (defaults bottom → top). */
  fromSide?: 'top' | 'bottom' | 'left' | 'right'
  toSide?: 'top' | 'bottom' | 'left' | 'right'
}

export interface FlowProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** Upper bound — the box never exceeds 65% of the viewport, so tall diagrams stay compact on phones. */
  height?: number
}

const HANDLE_CLASS = '!size-1.5 !border-none !bg-transparent'

function TileNode({ data }: NodeProps<Node<{ tile: TileData }>>) {
  return (
    <>
      <FlowTile tile={data.tile} />
      {/* One source + target handle per side; edges pick a side via handle id. */}
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
        const position = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right }[side]
        return (
          <span key={side}>
            <Handle id={side} type="source" position={position} className={HANDLE_CLASS} />
            <Handle id={`${side}-in`} type="target" position={position} className={HANDLE_CLASS} />
          </span>
        )
      })}
    </>
  )
}

const nodeTypes = { tile: TileNode }

const EDGE_STROKE = 'var(--color-fd-muted-foreground)'

export function Flow({ nodes, edges, height = 640 }: FlowProps) {
  const flowNodes: Node[] = nodes.map(({ x, y, ...tile }) => ({
    id: tile.id,
    type: 'tile',
    position: { x, y },
    data: { tile },
    draggable: false,
    connectable: false,
    selectable: false,
  }))
  const flowEdges: Edge[] = edges.map((edge, i) => ({
    id: `e${i}`,
    source: edge.from,
    target: edge.to,
    sourceHandle: edge.fromSide ?? 'bottom',
    targetHandle: `${edge.toSide ?? 'top'}-in`,
    type: 'smoothstep',
    label: edge.label,
    animated: edge.dashed,
    style: { stroke: EDGE_STROKE, strokeWidth: 1.5, ...(edge.dashed ? { strokeDasharray: '6 5' } : {}) },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STROKE },
    labelStyle: { fill: 'var(--color-fd-muted-foreground)', fontSize: 12 },
    labelBgStyle: { fill: 'var(--color-fd-background)', stroke: 'var(--color-fd-border)' },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 999,
  }))
  return (
    <div
      className="not-prose my-6 overflow-hidden rounded-xl border bg-fd-background"
      // Theme the Controls buttons with Fumadocs tokens through xyflow's own CSS variables.
      style={{
        // Don't chase a perfect fit: cap the box and let pan/zoom + the controls cover the rest.
        height: `min(${height}px, 65svh)`,
        ['--xy-controls-button-background-color' as string]: 'var(--color-fd-card)',
        ['--xy-controls-button-background-color-hover' as string]: 'var(--color-fd-accent)',
        ['--xy-controls-button-color' as string]: 'var(--color-fd-foreground)',
        ['--xy-controls-button-color-hover' as string]: 'var(--color-fd-foreground)',
        ['--xy-controls-button-border-color' as string]: 'var(--color-fd-border)',
        ['--xy-controls-box-shadow' as string]: 'none',
      }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.05 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-fd-border)" />
        <Controls position="bottom-left" showInteractive={false} fitViewOptions={{ padding: 0.05 }} />
      </ReactFlow>
    </div>
  )
}
