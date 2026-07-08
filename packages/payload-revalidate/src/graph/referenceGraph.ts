import type { Block, CollectionConfig, Field, GlobalConfig } from 'payload'

/**
 * One "can embed" relationship in the schema: an entry rendered from `from` may carry
 * `to`'s data at the field path `via`, so a write to `to` can make `from` surfaces stale.
 * `to: '*'` marks a richText field — what it embeds is per-document (any upload /
 * relationship its editor allows), discovered at runtime by the walk, not statically.
 */
export interface ReferenceEdge {
  from: string
  to: string
  /** Dotted field path from the document root, block slugs included: `layout.hero.image`. */
  via: string
  kind: 'relationship' | 'upload' | 'join' | 'richText'
  polymorphic?: boolean
  /** For `join` edges: the field on `to` (the child) whose value names the parent — the
   *  membership key the dev map keys `{to}:join:{on}:{parentId}` on. */
  on?: string
}

/** The static dependency map: what CAN revalidate what, derived purely from the config. */
export interface ReferenceGraph {
  collections: string[]
  globals: string[]
  edges: ReferenceEdge[]
}

type GraphSource = {
  collections?: CollectionConfig[] | { slug: string; fields: Field[] }[]
  globals?: GlobalConfig[] | { slug: string; fields: Field[] }[]
  blocks?: Block[]
}

const targets = (relationTo: string | string[]): { to: string[]; polymorphic: boolean } =>
  Array.isArray(relationTo) ? { to: relationTo, polymorphic: true } : { to: [relationTo], polymorphic: false }

/**
 * Build the static reference graph for a Payload config (or any `{ collections, globals }`
 * subset). Pure — safe at config-build time, in tests with fixture configs, and in the
 * dev map endpoint. Blocks referenced by name (`blockReferences`) resolve against the
 * config-level `blocks` registry when provided.
 */
export function buildReferenceGraph(config: GraphSource): ReferenceGraph {
  const blockRegistry = new Map((config.blocks ?? []).map((block) => [block.slug, block]))
  const edges: ReferenceEdge[] = []

  const addEdges = (
    from: string,
    kind: ReferenceEdge['kind'],
    via: string,
    relationTo: string | string[],
    extra?: Partial<ReferenceEdge>,
  ): void => {
    const { to, polymorphic } = targets(relationTo)
    for (const target of to) edges.push({ from, to: target, via, kind, ...(polymorphic ? { polymorphic } : {}), ...extra })
  }

  const walkFields = (from: string, fields: Field[] | undefined, parent: string): void => {
    for (const field of fields ?? []) {
      const path = 'name' in field && field.name ? (parent ? `${parent}.${field.name}` : field.name) : parent
      switch (field.type) {
        case 'relationship':
          addEdges(from, 'relationship', path, field.relationTo)
          break
        case 'upload':
          addEdges(from, 'upload', path, field.relationTo)
          break
        case 'join':
          addEdges(from, 'join', path, field.collection, { on: field.on })
          break
        case 'richText':
          edges.push({ from, to: '*', via: path, kind: 'richText' })
          break
        case 'array':
        case 'group':
          walkFields(from, field.fields, path)
          break
        case 'row':
        case 'collapsible':
          walkFields(from, field.fields, parent)
          break
        case 'tabs':
          for (const tab of field.tabs)
            walkFields(from, tab.fields, 'name' in tab && tab.name ? (parent ? `${parent}.${tab.name}` : tab.name) : parent)
          break
        case 'blocks': {
          const blocks = [
            ...(field.blocks ?? []),
            ...(field.blockReferences ?? []).map((ref) => (typeof ref === 'string' ? blockRegistry.get(ref) : ref)).filter((b) => b != null),
          ]
          for (const block of blocks) walkFields(from, block.fields, `${path}.${block.slug}`)
          break
        }
        default:
          break
      }
    }
  }

  const collections = (config.collections ?? []) as { slug: string; fields: Field[] }[]
  const globals = (config.globals ?? []) as { slug: string; fields: Field[] }[]
  for (const collection of collections) walkFields(collection.slug, collection.fields, '')
  for (const global of globals) walkFields(`global:${global.slug}`, global.fields, '')

  return { collections: collections.map((c) => c.slug), globals: globals.map((g) => g.slug), edges }
}
