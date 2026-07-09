import type { ReferenceEdge } from '../graph/referenceGraph'
import type { RevalidateInspection } from '../lib/inspect'
import { stashState, tags } from '../tags'

/**
 * Render a {@link RevalidateInspection} — the exact shape the plugin stashes and the
 * `GET /api/revalidate-map` endpoint returns — as a self-contained Markdown document: the
 * "what revalidates what" map an AI or developer can read to understand a project's cache
 * dependency structure without booting the app or opening the dev-tools view.
 *
 * Works on both the static inspection {@link buildStaticInspection} derives from a config
 * AND a live inspection with observed reads/events (pipe `curl …/api/revalidate-map` in) —
 * the live-only sections just render when present.
 */
export interface RenderMapOptions {
  /** Emit the observed-reads / bust-events sections when the inspection carries them. @default true */
  live?: boolean
}

const code = (s: string): string => `\`${s}\``
const list = (xs: string[]): string => (xs.length ? xs.map(code).join(', ') : '—')

/** Group edges by an accessor (`from` or `to`) into slug → edges. */
const groupBy = (edges: ReferenceEdge[], key: 'from' | 'to'): Map<string, ReferenceEdge[]> => {
  const out = new Map<string, ReferenceEdge[]>()
  for (const edge of edges) {
    const k = edge[key]
    ;(out.get(k) ?? out.set(k, []).get(k)!).push(edge)
  }
  return out
}

/** One `via (kind)` phrase per target, deduped, for the embed/embedded-by lines. */
const edgePhrase = (edges: ReferenceEdge[], nameKey: 'from' | 'to'): string[] =>
  [...groupBy(edges, nameKey)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, es]) =>
        `${code(name)} via ${es.map((e) => code(e.via === '' ? '(root)' : e.via)).join(', ')} (${[...new Set(es.map((e) => e.kind))].join('/')})`,
    )

export function renderRevalidateMap(inspection: RevalidateInspection, opts: RenderMapOptions = {}): string {
  const { graph, prefix, observing, rules, settings, reads, events } = inspection
  // The tag builders read the prefix from the globalThis state slot — seed it so examples
  // below carry the same namespace the app's hooks and `./cache` helpers apply.
  stashState({ prefix, observe: false })
  const live = opts.live ?? true
  const slugs = Object.keys(settings).sort()
  const optedOut = graph.collections.filter((slug) => !settings[slug]).sort()
  const byFrom = groupBy(graph.edges, 'from')
  const byTo = groupBy(graph.edges, 'to')
  const sample = slugs[0] ?? graph.collections.find((s) => settings[s]) ?? 'posts'
  const lines: string[] = []
  const w = (s = ''): void => void lines.push(s)

  w(`# Revalidation map${prefix ? ` — namespace \`${prefix}\`` : ''}`)
  w()
  w('_Cache dependency map from `@pro-laico/payload-revalidate`: what a write to each collection revalidates,')
  w('and which tags every surface carries. Generated from the Payload config — it shows what CAN revalidate what._')
  w()

  w('## Summary')
  w()
  w(`- Namespace prefix: ${prefix ? code(prefix) : '(none)'}`)
  w(`- Collections tracked: ${slugs.length}${optedOut.length ? ` (opted out: ${list(optedOut)})` : ''}`)
  w(`- Globals hooked: ${graph.globals.length}${graph.globals.length ? ` — ${list(graph.globals)}` : ''}`)
  w(`- Reference edges: ${graph.edges.length}`)
  w(`- Manual dependency rules: ${rules.length}`)
  if (live && observing) w(`- Live observation: on — ${reads.length} read(s), ${events.length} event(s) recorded this process`)
  w()

  w('## Tag vocabulary')
  w()
  if (prefix) w(`Every tag is prefixed with \`${prefix}:\`. Examples below use \`${sample}\`.`)
  else w(`Examples below use \`${sample}\`.`)
  w()
  w('| Tag | Example | Busted when |')
  w('| --- | --- | --- |')
  w(`| \`{slug}\` | ${code(tags.list(sample))} | list membership changes (create / delete / publish / unpublish) |`)
  w(`| \`{slug}:{id}\` | ${code(tags.doc(sample, 42))} | that doc changes, or any entry embedding it |`)
  w(`| \`{slug}:{id}:draft\` | ${code(tags.doc(sample, 42, { draft: true }))} | draft-lane save of that doc |`)
  w(
    `| \`{slug}:list:{scope}\` | ${code(tags.list(sample, { scope: 'recent' }))} | a declared scope's membership or determinant fields change |`,
  )
  w(`| \`{child}:join:{on}:{parentId}\` | ${code(tags.join(sample, 'category', 7))} | a child joins/leaves that parent |`)
  w(`| \`global:{slug}\` | ${code(tags.global('header'))} | that global changes |`)
  w(`| \`all\` | ${code(tags.all())} | \`revalidateAll()\` — every \`./cache\` read |`)
  w()

  w('## Collections')
  w()
  for (const slug of slugs) {
    const s = settings[slug]!
    w(`### ${slug}`)
    w()
    w(
      `- Doc tag: ${code(tags.doc(slug, '{id}'))}${s.idField ? ` — alias ${code(tags.doc(slug, `{${s.idField}}`))} via \`${s.idField}\`` : ' (no alias)'}`,
    )
    w(`- List tag: ${code(tags.list(slug))}`)
    const scopes = Object.entries(s.lists)
    if (scopes.length) {
      w('- List scopes:')
      for (const [scope, fields] of scopes)
        w(`  - ${code(tags.list(slug, { scope }))} — re-tagged on membership change or when these change: ${list(fields)}`)
    }
    if (s.extraTags.length) w(`- Extra tags (busted on every published write): ${list(s.extraTags)}`)
    const embeds = byFrom.get(slug) ?? []
    const embeddedBy = byTo.get(slug) ?? []
    if (embeds.length) w(`- Goes stale when these change (it embeds them): ${edgePhrase(embeds, 'to').join('; ')}`)
    if (embeddedBy.length) w(`- A write here makes these stale (they embed it): ${edgePhrase(embeddedBy, 'from').join('; ')}`)
    const relatedRules = rules.filter((r) => r.on === slug)
    for (const r of relatedRules)
      w(`- Rule: a write here also busts ${list(r.bust)}${r.whenFields?.length ? ` (when ${list(r.whenFields)} change)` : ''}`)
    w()
  }

  if (graph.edges.length) {
    w('## Reference graph (every edge)')
    w()
    w("_A write to **To** can make **From** stale, because From carries To's data at **Via**._")
    w()
    w('| From | Via | Kind | To |')
    w('| --- | --- | --- | --- |')
    for (const e of [...graph.edges].sort((a, b) => a.from.localeCompare(b.from) || a.via.localeCompare(b.via)))
      w(`| ${code(e.from)} | ${code(e.via === '' ? '(root)' : e.via)} | ${e.kind}${e.polymorphic ? ', poly' : ''} | ${code(e.to)} |`)
    w()
  }

  if (rules.length) {
    w('## Manual dependency rules')
    w()
    for (const r of rules) w(`- on ${code(r.on)} → bust ${list(r.bust)}${r.whenFields?.length ? ` (when ${list(r.whenFields)} change)` : ''}`)
    w()
  }

  if (live && observing && (reads.length || events.length)) {
    w('## Live (this process)')
    w()
    if (reads.length) {
      w('Materialized cached reads:')
      w()
      for (const r of reads.slice(0, 50))
        w(
          `- ${r.label ?? r.kind} ${code(r.global ?? r.collection ?? '?')}${r.as !== undefined ? ` (${r.as})` : ''} — ${r.depTags.length} dep tag(s), ${r.count}× ${r.capped ? '⚠ capped' : ''}`,
        )
      w()
    }
    if (events.length) {
      w('Recent revalidation events:')
      w()
      for (const e of events.slice(-50)) w(`- ${code(e.trigger.slug)} \`${e.trigger.operation}\` → busted ${list(e.busted.map((b) => b.tag))}`)
      w()
    }
  }

  return lines.join('\n')
}
