import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GraphNode, SeedGraph } from './graph'

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_')

function nodeShape(node: GraphNode): string {
  const label = node.label.replace(/"/g, "'")
  // asset = stadium, global = hexagon, doc = rounded rect
  if (node.type === 'asset') return `${safeId(node.id)}(["${label}"])`
  if (node.type === 'global') return `${safeId(node.id)}{{"${label}"}}`
  return `${safeId(node.id)}["${label}"]`
}

/** Render the graph as a Mermaid `graph LR` definition. */
export function toMermaid(graph: SeedGraph): string {
  const lines = ['graph LR']
  const declared = new Set<string>()
  const declare = (node: GraphNode) => {
    if (declared.has(node.id)) return
    declared.add(node.id)
    lines.push(`  ${nodeShape(node)}`)
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const node of graph.nodes) declare(node)
  for (const edge of graph.edges) {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (from && to) lines.push(`  ${safeId(edge.from)} --> ${safeId(edge.to)}`)
  }
  // Style by type
  lines.push('  classDef asset fill:#fef3c7,stroke:#f59e0b;')
  lines.push('  classDef global fill:#ede9fe,stroke:#8b5cf6;')
  lines.push('  classDef doc fill:#dbeafe,stroke:#3b82f6;')
  for (const node of graph.nodes) lines.push(`  class ${safeId(node.id)} ${node.type};`)
  return lines.join('\n')
}

function toHtml(graph: SeedGraph, mermaid: string): string {
  const order = graph.order.map((id, i) => `<li>${i + 1}. <code>${id}</code></li>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>payload-seed — dependency graph</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; color: #0f172a; }
  h1 { font-size: 1.2rem; } h2 { font-size: 1rem; margin-top: 2rem; }
  .legend span { display: inline-block; margin-right: 1rem; }
  .swatch { display: inline-block; width: .8em; height: .8em; border-radius: 3px; vertical-align: middle; margin-right: .35em; }
  ol, ul { padding-left: 1.25rem; } code { background: #f1f5f9; padding: 0 .25em; border-radius: 3px; }
  .mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
</style>
</head>
<body>
<h1>Seed dependency graph</h1>
<p class="legend">
  <span><span class="swatch" style="background:#dbeafe"></span>document</span>
  <span><span class="swatch" style="background:#fef3c7"></span>asset</span>
  <span><span class="swatch" style="background:#ede9fe"></span>global</span>
</p>
<div class="mermaid">
${mermaid}
</div>
<h2>Create order (${graph.order.length} docs)</h2>
<ol>${order}</ol>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
  mermaid.initialize({ startOnLoad: true })
</script>
</body>
</html>`
}

/** Write `graph.html` (Mermaid) and, optionally, `graph.json` next to it. */
export async function writeGraphArtifact(graph: SeedGraph, output: string, json: boolean): Promise<void> {
  await mkdir(dirname(output), { recursive: true })
  const mermaid = toMermaid(graph)
  await writeFile(output, toHtml(graph, mermaid), 'utf8')
  if (json) {
    const jsonPath = `${output.replace(/\.html?$/i, '')}.json`
    await writeFile(jsonPath, JSON.stringify({ nodes: graph.nodes, edges: graph.edges, order: graph.order }, null, 2), 'utf8')
  }
}
