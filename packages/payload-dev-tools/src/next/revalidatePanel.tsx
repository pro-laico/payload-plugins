'use client'

import '@xyflow/react/dist/style.css'

import dagre from '@dagrejs/dagre'
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import { useMemo, useState } from 'react'
import { BustTagCard } from './client'

/** The live-inspection shape payload-revalidate stashes on its shared symbol slot
 *  (structural — no import; the server view reads the slot and passes plain data in). */
export type RevalidateInspection = {
  graph: {
    collections: string[]
    globals: string[]
    edges: { from: string; to: string; via: string; kind: string; polymorphic?: boolean }[]
  }
  prefix: string
  observing: boolean
  rules: { on: string; bust: string[]; whenFields?: string[] }[]
  settings: Record<string, { idField: string | false; lists: Record<string, string[]>; extraTags: string[]; fields: string[] }>
  getters: {
    helper: 'cacheDoc' | 'cacheIds' | 'cacheGlobal'
    slug: string
    list?: string
    label?: string
    getter?: string
    file: string
    line: number
  }[]
  reads: {
    kind: string
    collection?: string
    global?: string
    as?: string | number
    list?: string
    undeclared?: boolean
    draft: boolean
    label?: string
    staticTags: string[]
    depTags: string[]
    bakedIn: { tag: string; via: string; kind: string }[]
    capped: boolean
    lastAt: string
    count: number
  }[]
  events: {
    at: string
    source: string
    trigger: { slug: string; id?: string | number; operation: string; lane: string }
    busted: { tag: string; reason: string }[]
  }[]
}

type Read = RevalidateInspection['reads'][number]

const RICH_TEXT_NODE = '*'
const clock = (iso: string): string => iso.slice(11, 19)
const label = (node: string): string => (node === RICH_TEXT_NODE ? 'richText embeds' : node)
const readName = (read: Read): string =>
  read.label ??
  `${read.kind}:${read.collection ?? read.global ?? '?'}${read.as !== undefined ? `:${read.as}` : ''}${read.list ? `:${read.list}` : ''}${read.draft ? ' (draft)' : ''}`

/** Which node a read belongs to, and which collection a tag points at (prefix-aware). */
const readNode = (read: Read): string | null => read.collection ?? (read.global ? `global:${read.global}` : null)
const tagCollection = (tag: string, prefix: string): string => {
  const bare = prefix && tag.startsWith(`${prefix}:`) ? tag.slice(prefix.length + 1) : tag
  return bare.split(':')[0] ?? bare
}

/** Observed bake-ins as `edited -> renderer` pairs — colors the schema edges by real usage. */
const bakedPairs = (reads: Read[], prefix: string): Set<string> => {
  const pairs = new Set<string>()
  for (const read of reads) {
    const renderer = readNode(read)
    if (!renderer) continue
    for (const embed of read.bakedIn) pairs.add(`${tagCollection(embed.tag, prefix)}->${renderer}`)
  }
  return pairs
}

// ---------------------------------------------------------------------------
// Explore tab — the React Flow dependency graph
// ---------------------------------------------------------------------------

type GraphNodeData = { title: string; kind: 'collection' | 'global' | 'richText'; reads: number; baked: number; selected: boolean }

function GraphNode({ data }: NodeProps<FlowNode<GraphNodeData>>) {
  return (
    <div className={`pdtp-flow-node ${data.selected ? 'pdtp-flow-node-active' : ''}`}>
      <Handle type="target" position={Position.Left} className="pdtp-flow-handle" />
      <span className="pdtp-mono">{data.title}</span>
      <span className="pdtp-flow-badges">
        {data.kind !== 'collection' ? <em>{data.kind === 'global' ? 'global' : 'per-doc'}</em> : null}
        {data.reads ? <em>{data.reads} reads</em> : null}
        {data.baked ? <em className="pdtp-flow-warn">{data.baked} baked ⚠</em> : null}
      </span>
      <Handle type="source" position={Position.Right} className="pdtp-flow-handle" />
    </div>
  )
}

const nodeTypes: NodeTypes = { pdtp: GraphNode }

/** Left→right layered layout: sources are the things you EDIT, targets the surfaces that
 *  go stale. Sized by label so dagre spaces long slugs correctly. */
const layout = (nodes: FlowNode<GraphNodeData>[], edges: FlowEdge[]): FlowNode<GraphNodeData>[] => {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 120 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes) g.setNode(node.id, { width: 30 + node.data.title.length * 8 + (node.data.reads ? 60 : 0), height: 40 })
  for (const edge of edges) g.setEdge(edge.source, edge.target)
  dagre.layout(g)
  return nodes.map((node) => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } }
  })
}

function ExploreTab({
  data,
  selected,
  onSelect,
}: {
  data: RevalidateInspection
  selected: string | null
  onSelect: (n: string | null) => void
}) {
  const { nodes, edges } = useMemo(() => {
    const baked = bakedPairs(data.reads, data.prefix)
    const readCounts = new Map<string, number>()
    const bakedCounts = new Map<string, number>()
    for (const read of data.reads) {
      const node = readNode(read)
      if (!node) continue
      readCounts.set(node, (readCounts.get(node) ?? 0) + 1)
      if (read.bakedIn.length) bakedCounts.set(node, (bakedCounts.get(node) ?? 0) + 1)
    }

    const ids = [...data.graph.collections, ...data.graph.globals.map((g) => `global:${g}`)]
    const hasRichText = data.graph.edges.some((e) => e.to === RICH_TEXT_NODE)
    const allIds = hasRichText ? [...ids, RICH_TEXT_NODE] : ids

    const flowNodes: FlowNode<GraphNodeData>[] = allIds.map((id) => ({
      id,
      type: 'pdtp',
      position: { x: 0, y: 0 },
      data: {
        title: label(id),
        kind: id === RICH_TEXT_NODE ? 'richText' : id.startsWith('global:') ? 'global' : 'collection',
        reads: readCounts.get(id) ?? 0,
        baked: bakedCounts.get(id) ?? 0,
        selected: selected === id,
      },
    }))

    // Direction of staleness: editing `edge.to` makes `edge.from` stale — source is the
    // edited side so the graph reads left (cause) → right (effect).
    const flowEdges: FlowEdge[] = data.graph.edges.map((edge) => {
      const isBaked = baked.has(`${edge.to}->${edge.from}`)
      const active = selected !== null && (edge.to === selected || edge.from === selected)
      const dimmed = selected !== null && !active
      return {
        id: `${edge.from}|${edge.via}|${edge.to}`,
        source: edge.to,
        target: edge.from,
        animated: isBaked && !dimmed,
        label: active ? `${edge.via} (${edge.kind})` : undefined,
        style: {
          stroke: isBaked ? 'var(--pdtp-warn)' : 'oklch(1 0 0 / 30%)',
          strokeWidth: active ? 2 : 1.25,
          strokeDasharray: edge.kind === 'richText' || edge.to === RICH_TEXT_NODE ? '5 5' : undefined,
          opacity: dimmed ? 0.15 : 1,
        },
        labelStyle: { fill: 'var(--pdtp-fg)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--pdtp-card)' },
      }
    })

    return { nodes: layout(flowNodes, flowEdges), edges: flowEdges }
  }, [data, selected])

  return (
    <>
      <div className="pdtp-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          minZoom={0.3}
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onSelect(selected === node.id ? null : node.id)}
          onPaneClick={() => onSelect(null)}
        >
          <Background gap={24} />
        </ReactFlow>
      </div>
      <p className="pdtp-note" style={{ marginTop: 8 }}>
        Left → right: editing a node makes its right-hand neighbors stale. <span className="pdtp-warn">Amber animated</span> edges are OBSERVED
        bake-ins (populated content — the anti-pattern); grey edges are id-references or not yet observed; dashed = richText (per-doc). Click a
        node for its full story.
      </p>

      {selected ? <NodeDetail node={selected} data={data} /> : null}
    </>
  )
}

/**
 * The focused, evidence-based answer for one node — three layers, never conflated:
 *
 * 1. **What a write here busts** — tags, by event kind. Facts from the decision table.
 * 2. **What observably purges right now** — the cached entries that actually carry those
 *    tags. This is the truth of "what happens if I edit/create a doc here today".
 * 3. **Potential coupling** — schema edges. A reference alone never propagates a purge
 *    (ids are stable); an edge only becomes real when a getter is OBSERVED baking the
 *    content in. Each edge is labeled accordingly.
 */
function NodeDetail({ node, data }: { node: string; data: RevalidateInspection }) {
  const { graph, rules, reads, prefix } = data
  const p = prefix ? `${prefix}:` : ''
  const isGlobal = node.startsWith('global:')
  const slug = isGlobal ? node.slice('global:'.length) : node
  const settings = data.settings[slug]
  const baked = bakedPairs(reads, prefix)

  const makesStale = graph.edges.filter((e) => e.to === node)
  const staleWhen = graph.edges.filter((e) => e.from === node)
  const ownRules = rules.filter((r) => r.on === slug)
  const scopes = Object.entries(settings?.lists ?? {})

  // Observed: entries carrying this collection's DOC tags (own entries + bake-ins)…
  const docTagCarriers = new Map<string, { name: string; baked: boolean }[]>()
  // …and entries carrying its LIST tags (what membership events actually purge).
  const listCarriers = reads.filter((read) => read.kind === 'ids' && read.collection === slug)
  if (!isGlobal && node !== RICH_TEXT_NODE) {
    for (const read of reads) {
      for (const tag of [...read.staticTags, ...read.depTags]) {
        if (!tag.startsWith(`${p}${slug}:`) || tag.startsWith(`${p}${slug}:list:`) || tag.endsWith(':draft')) continue
        const isBaked = read.bakedIn.some((b) => b.tag === tag)
        docTagCarriers.set(tag, [...(docTagCarriers.get(tag) ?? []), { name: readName(read), baked: isBaked }])
      }
    }
  }

  if (node === RICH_TEXT_NODE) {
    return (
      <div className="pdtp-card" style={{ marginTop: 16 }}>
        <h2>
          richText embeds <span className="pdtp-kind">per-doc</span>
        </h2>
        <p className="pdtp-note" style={{ margin: 0 }}>
          Upload/relationship nodes inside rich text resolve per document at read time. Populated nodes bake content in and tag the entry (shown
          as bake-ins on the owning read); id-only nodes are references — render them through id-keyed getters.
        </p>
      </div>
    )
  }

  // The getters the CODE declares for this node (live source scan), matched against
  // runtime observation so each shows whether it has materialized yet.
  const helperKind = { cacheDoc: 'doc', cacheIds: 'ids', cacheGlobal: 'global' } as const
  const nodeGetters = data.getters
    .filter((g) => g.slug === slug && (isGlobal ? g.helper === 'cacheGlobal' : g.helper !== 'cacheGlobal'))
    .map((g) => {
      const observed = reads.find(
        (read) =>
          (read.collection ?? read.global) === slug &&
          read.kind === helperKind[g.helper] &&
          (read.list ?? undefined) === (g.list ?? undefined) &&
          (g.label === undefined || read.label === g.label),
      )
      return { ...g, observed }
    })

  const vocabulary = isGlobal
    ? [`${p}global:${slug}`, `${p}global:${slug}:draft`]
    : [
        `${p}${slug}:{id}`,
        ...(settings?.idField ? [`${p}${slug}:{${settings.idField}}`] : []),
        `${p}${slug}`,
        ...scopes.map(([scope]) => `${p}${slug}:list:${scope}`),
        '+ :draft variants',
      ]

  return (
    <div className="pdtp-card" style={{ marginTop: 16 }}>
      <h2>
        {label(node)} <span className="pdtp-kind">{isGlobal ? 'global' : 'collection'}</span>
      </h2>

      {/* 0 — the tag vocabulary this node lives under */}
      <p className="pdtp-note" style={{ margin: '0 0 12px' }}>
        Tags:{' '}
        {vocabulary.map((tag) => (
          <span key={tag} className="pdtp-code" style={{ marginRight: 6 }}>
            {tag}
          </span>
        ))}
      </p>

      {/* 1 — the facts: which write busts which tags */}
      <h3 className="pdtp-rev-subhead">A write here busts…</h3>
      <ul className="pdtp-rev-list">
        {isGlobal ? (
          <li>
            any save → <span className="pdtp-code">{`${p}global:${slug}`}</span>
          </li>
        ) : (
          <>
            <li>
              editing a doc → <span className="pdtp-code">{`${p}${slug}:{id}`}</span>
              {settings?.idField ? (
                <>
                  {' '}
                  + <span className="pdtp-code">{`${p}${slug}:{${settings.idField}}`}</span>
                </>
              ) : null}{' '}
              <span className="pdtp-muted">— that one doc, nothing else</span>
            </li>
            <li>
              create / delete / publish / unpublish → also <span className="pdtp-code">{`${p}${slug}`}</span>
              {scopes.map(([scope]) => (
                <span key={scope}>
                  {' '}
                  + <span className="pdtp-code">{`${p}${slug}:list:${scope}`}</span>
                </span>
              ))}{' '}
              <span className="pdtp-muted">— membership changed</span>
            </li>
            {scopes.map(([scope, fields]) => (
              <li key={scope}>
                editing <span className="pdtp-mono">{fields.join(' / ')}</span> → also{' '}
                <span className="pdtp-code">{`${p}${slug}:list:${scope}`}</span> <span className="pdtp-muted">— order/filter changed</span>
              </li>
            ))}
            {settings?.extraTags.length ? (
              <li>
                every published write → also <span className="pdtp-mono">{settings.extraTags.join(', ')}</span>
              </li>
            ) : null}
            {ownRules.length ? (
              <li>
                rules → also <span className="pdtp-mono">{ownRules.flatMap((r) => r.bust).join(', ')}</span>
              </li>
            ) : null}
          </>
        )}
      </ul>

      {/* 2 — the observed reality: which entries those tags actually purge today */}
      <h3 className="pdtp-rev-subhead" style={{ marginTop: 14 }}>
        …which currently purges (observed)
      </h3>
      {docTagCarriers.size ? (
        <ul className="pdtp-rev-list">
          {[...docTagCarriers.entries()].slice(0, 10).map(([tag, carriers]) => (
            <li key={tag}>
              <span className="pdtp-code">{tag}</span> →{' '}
              {carriers.map((c, i) => (
                <span key={c.name}>
                  {i > 0 ? ', ' : ''}
                  {c.name}
                  {c.baked ? <span className="pdtp-warn"> (baked-in ⚠)</span> : <span className="pdtp-muted"> (own entry ✓)</span>}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : !isGlobal ? (
        <p className="pdtp-muted" style={{ margin: 0 }}>
          No cached entries carry {slug} doc tags yet — editing a {slug} doc right now purges nothing (its entry materializes, tagged, on first
          read).
        </p>
      ) : null}
      {!isGlobal ? (
        <p className="pdtp-note">
          {listCarriers.length ? (
            <>
              Membership events purge: {listCarriers.map((read) => readName(read)).join(', ')}
              {' — '}the id-lists re-query; every unchanged card entry survives.
            </>
          ) : (
            <>
              Membership events currently purge <strong>nothing</strong> — no id-list read carries{' '}
              <span className="pdtp-code">{`${p}${slug}`}</span> or a scope yet. Creating or deleting a {slug} doc is invisible to the cache
              until a `cacheIds` read exists.
            </>
          )}
        </p>
      ) : null}

      {/* 2b — the getters the code declares for this node (source scan + runtime match) */}
      {nodeGetters.length ? (
        <div style={{ marginTop: 14 }}>
          <h3 className="pdtp-rev-subhead">Getters in your code</h3>
          <ul className="pdtp-rev-list">
            {nodeGetters.map((g) => (
              <li key={`${g.file}:${g.line}`}>
                <strong>{g.getter ? `${g.getter}()` : (g.label ?? g.helper)}</strong>{' '}
                <span className="pdtp-mono pdtp-muted">
                  {g.helper}
                  {g.list ? ` · list:${g.list}` : ''} · {g.file}:{g.line}
                </span>{' '}
                {g.observed ? (
                  <span className="pdtp-muted">
                    materialized ×{g.observed.count}
                    {g.observed.bakedIn.length ? <span className="pdtp-warn"> · {g.observed.bakedIn.length} baked-in ⚠</span> : null}
                    {g.observed.undeclared ? <span className="pdtp-warn"> · undeclared scope!</span> : null}
                  </span>
                ) : (
                  <span className="pdtp-muted">not yet observed</span>
                )}
              </li>
            ))}
          </ul>
          <p className="pdtp-note">Found by scanning your source for cache-helper calls (literal slugs only) — the payload-icons pattern.</p>
        </div>
      ) : null}

      {/* 3 — potential coupling: schema edges, real only when observed baked */}
      <div className="pdtp-rev-cols" style={{ marginTop: 14 }}>
        <div>
          <h3 className="pdtp-rev-subhead">Can be referenced by (schema)</h3>
          {makesStale.length ? (
            <ul className="pdtp-rev-list">
              {makesStale.map((edge) => {
                const observedBaked = baked.has(`${node}->${edge.from}`)
                return (
                  <li key={`${edge.from}-${edge.via}`}>
                    <strong>{edge.from}</strong>{' '}
                    <span className="pdtp-mono pdtp-muted">
                      via {edge.via} ({edge.kind})
                    </span>{' '}
                    {observedBaked ? (
                      <span className="pdtp-warn">baked-in ⚠ — edits here DO purge those entries</span>
                    ) : (
                      <span className="pdtp-muted">reference only — no purge propagation</span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="pdtp-muted" style={{ margin: 0 }}>
              No schema field references it.
            </p>
          )}
        </div>
        <div>
          <h3 className="pdtp-rev-subhead">References (schema)</h3>
          {staleWhen.length ? (
            <ul className="pdtp-rev-list">
              {staleWhen.map((edge) => {
                const observedBaked = baked.has(`${edge.to}->${node}`)
                return (
                  <li key={`${edge.to}-${edge.via}`}>
                    <strong>{label(edge.to)}</strong>{' '}
                    <span className="pdtp-mono pdtp-muted">
                      via {edge.via} ({edge.kind})
                    </span>{' '}
                    {observedBaked ? (
                      <span className="pdtp-warn">baked-in ⚠ — its edits purge {slug} entries</span>
                    ) : (
                      <span className="pdtp-muted">id only — its edits never touch {slug} entries</span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="pdtp-muted" style={{ margin: 0 }}>
              References nothing.
            </p>
          )}
        </div>
      </div>

      <p className="pdtp-note">
        A reference (id) never couples two entries — the id is stable, and the referenced doc's freshness lives in its own id-keyed entry. Only{' '}
        <span className="pdtp-warn">baked-in ⚠</span> rows propagate purges; refactor those getters to shrink the blast radius.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fields tab — the per-field blast-radius table
// ---------------------------------------------------------------------------

function FieldsTab({ data }: { data: RevalidateInspection }) {
  const entries = Object.entries(data.settings)
  if (!entries.length) return <p className="pdtp-muted">No collections registered.</p>

  return (
    <>
      {entries.map(([slug, s]) => (
        <div key={slug} className="pdtp-card" style={{ marginBottom: 14 }}>
          <h2>
            {slug}{' '}
            <span className="pdtp-kind">{Object.keys(s.lists).length ? `lists: ${Object.keys(s.lists).join(', ')}` : 'no declared lists'}</span>
          </h2>
          <table className="pdtp-table">
            <thead>
              <tr>
                <th>editing field…</th>
                <th>busts</th>
              </tr>
            </thead>
            <tbody>
              {s.fields.map((field) => {
                const scopes = Object.entries(s.lists)
                  .filter(([, fields]) => fields.includes(field))
                  .map(([scope]) => scope)
                return (
                  <tr key={field}>
                    <td className="pdtp-mono">{field}</td>
                    <td className="pdtp-mono">
                      doc
                      {field === s.idField ? ' + alias (old & new)' : ''}
                      {scopes.length ? ` + ${scopes.map((scope) => `list:${scope}`).join(' + ')}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="pdtp-note">
            Create / delete / publish / unpublish additionally bust <span className="pdtp-code">{slug}</span>
            {Object.keys(s.lists).map((scope) => (
              <span key={scope}>
                {' '}
                + <span className="pdtp-code">{`${slug}:list:${scope}`}</span>
              </span>
            ))}
            {s.extraTags.length ? <> · every published write also busts {s.extraTags.join(', ')}</> : null}
          </p>
        </div>
      ))}

      {data.rules.length ? (
        <div className="pdtp-section">
          <h2>
            Manual rules <span className="pdtp-kind">{data.rules.length}</span>
          </h2>
          <table className="pdtp-table">
            <tbody>
              {data.rules.map((rule) => (
                <tr key={`${rule.on}-${rule.bust.join(',')}`}>
                  <td className="pdtp-code">{rule.on}</td>
                  <td className="pdtp-mono">busts {rule.bust.join(', ')}</td>
                  <td className="pdtp-muted">{rule.whenFields ? `when ${rule.whenFields.join(', ')} change` : 'always'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Reads + Events tabs
// ---------------------------------------------------------------------------

function ReadsTab({ data }: { data: RevalidateInspection }) {
  return data.reads.length ? (
    <>
      <table className="pdtp-table">
        <thead>
          <tr>
            <th>read</th>
            <th>tags</th>
            <th>health</th>
            <th>seen</th>
            <th>last</th>
          </tr>
        </thead>
        <tbody>
          {data.reads.map((read) => {
            const all = [...read.staticTags, ...read.depTags]
            return (
              <tr key={readName(read)}>
                <td className="pdtp-code">{readName(read)}</td>
                <td className="pdtp-mono" title={all.join('\n')}>
                  {all.length}
                </td>
                <td>
                  {read.undeclared ? <span className="pdtp-warn">undeclared scope! </span> : null}
                  {read.bakedIn.length ? (
                    <span className="pdtp-warn" title={read.bakedIn.map((b) => `${b.via} → ${b.tag}`).join('\n')}>
                      {read.bakedIn.length} baked-in ⚠
                    </span>
                  ) : null}
                  {read.capped ? <span className="pdtp-warn"> capped!</span> : null}
                  {!read.undeclared && !read.bakedIn.length && !read.capped ? <span className="pdtp-muted">atomic ✓</span> : null}
                </td>
                <td className="pdtp-mono">×{read.count}</td>
                <td className="pdtp-mono">{clock(read.lastAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="pdtp-note">
        Hover a tag count for the full list, a baked-in badge for the field paths. Reads record on cache miss (a hit never re-executes the
        getter).
      </p>
    </>
  ) : (
    <p className="pdtp-muted">Nothing materialized yet — reads appear here the first time a cacheDoc/cacheIds/cacheGlobal getter runs.</p>
  )
}

function EventsTab({ data, endpointPath }: { data: RevalidateInspection; endpointPath: string | null }) {
  return (
    <>
      {data.events.length ? (
        <table className="pdtp-table">
          <thead>
            <tr>
              <th>at</th>
              <th>trigger</th>
              <th>busted</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((event) => (
              <tr key={`${event.at}-${event.trigger.slug}-${event.trigger.id ?? ''}`}>
                <td className="pdtp-mono">{clock(event.at)}</td>
                <td>
                  <span className="pdtp-code">
                    {event.trigger.operation} {event.trigger.slug}
                    {event.trigger.id !== undefined ? `:${event.trigger.id}` : ''}
                  </span>
                  {event.trigger.lane === 'draft' ? <span className="pdtp-muted"> draft</span> : null}
                </td>
                <td className="pdtp-mono" title={event.busted.map((b) => `${b.tag} (${b.reason})`).join('\n')}>
                  {event.busted
                    .slice(0, 4)
                    .map((b) => b.tag)
                    .join(', ')}
                  {event.busted.length > 4 ? ` +${event.busted.length - 4}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pdtp-muted">No busts recorded yet — edit something in the admin panel.</p>
      )}
      {endpointPath ? <BustTagCard endpointPath={endpointPath} /> : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// The tabbed panel
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'explore', title: 'Explore' },
  { key: 'fields', title: 'Fields' },
  { key: 'reads', title: 'Reads' },
  { key: 'events', title: 'Events' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** The `/dev/revalidate` panel — tabbed so a grown project stays navigable: Explore (the
 *  interactive dependency graph + per-node lookup), Fields (the per-field blast-radius
 *  tables), Reads (observed cache entries with atomic-health badges), Events (the bust
 *  log + manual bust box). */
export function RevalidatePanel({ data, endpointPath }: { data: RevalidateInspection; endpointPath: string | null }) {
  const [tab, setTab] = useState<TabKey>('explore')
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <>
      {!data.observing ? (
        <p className="pdtp-warn" style={{ marginTop: 0 }}>
          Observation is off (`observe: false`) — the graph is static config analysis only; reads and events aren't recorded.
        </p>
      ) : null}

      <div className="pdtp-seg" style={{ marginBottom: 20 }}>
        {TABS.map(({ key, title }) => (
          <button key={key} type="button" className={tab === key ? 'pdtp-active' : ''} onClick={() => setTab(key)}>
            {title}
            {key === 'reads' && data.reads.length ? ` · ${data.reads.length}` : ''}
            {key === 'events' && data.events.length ? ` · ${data.events.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'explore' ? <ExploreTab data={data} selected={selected} onSelect={setSelected} /> : null}
      {tab === 'fields' ? <FieldsTab data={data} /> : null}
      {tab === 'reads' ? <ReadsTab data={data} /> : null}
      {tab === 'events' ? <EventsTab data={data} endpointPath={endpointPath} /> : null}

      <p className="pdtp-note">
        Machine-readable: <span className="pdtp-code">GET {endpointPath ?? '/api/revalidate-map'}</span> serves all of this as JSON
        {data.prefix ? (
          <>
            {' '}
            · tag prefix <span className="pdtp-code">{data.prefix}</span>
          </>
        ) : null}
      </p>
    </>
  )
}
