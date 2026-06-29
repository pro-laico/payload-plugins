import { createLocalReq, type CollectionSlug, type Payload, type PayloadRequest } from 'payload'
import { resolveOptions, type ResolvedSeedOptions, type SeedPluginOptions } from '../options'
import { asset, ref, video } from '../refs'
import type { AssetSpec, SeedDefinition } from '../types'
import { uploadAssets } from './assets'
import { type BuiltCollection, type BuiltGlobal, type BuiltModel, buildGraph } from './graph'
import { collectSourceRefs, resolveSourceFiles } from './sources'
import { docNodeId, resolveTokens } from './tokens'
import { validateModel } from './validate'

export interface SeedResult {
  /** Created doc counts keyed by collection slug (includes uploaded assets). */
  created: Record<string, number>
  /** The computed topological create order (doc node ids, `collection:_key`). */
  order: string[]
}

export interface RunSeedArgs {
  payload: Payload
  req: PayloadRequest
  options: ResolvedSeedOptions
  /** Seed definitions. Falls back to `options.definitions` when omitted. */
  definitions?: SeedDefinition[]
}

const tokens = { ref, asset, video }

/** Split definitions by kind and build the concrete model (records/globals/assets). */
function buildModel(definitions: SeedDefinition[]): { model: BuiltModel; specs: Record<string, AssetSpec> } {
  const specs: Record<string, AssetSpec> = {}
  const collections: BuiltCollection[] = []
  const globals: BuiltGlobal[] = []

  for (const def of definitions) {
    if (def.kind === 'assets') Object.assign(specs, def.specs)
  }
  for (const def of definitions) {
    if (def.kind === 'collection') {
      const built = def.build(tokens).map((rec) => {
        const { _key, ...data } = rec as { _key: string } & Record<string, unknown>
        return { key: _key, data }
      })
      collections.push({ slug: def.slug, records: built })
    } else if (def.kind === 'global') {
      globals.push({ slug: def.slug, data: def.build(tokens) as Record<string, unknown> })
    }
  }

  return { model: { assetKeys: Object.keys(specs), collections, globals }, specs }
}

async function clearCollection(payload: Payload, req: PayloadRequest, collection: string, withHooks: boolean): Promise<void> {
  const config = payload.collections[collection as CollectionSlug]?.config
  if (!config) return
  payload.logger.info(`[payload-seed] clearing ${collection}`)
  if (config.upload || withHooks) {
    await payload.delete({
      collection: collection as CollectionSlug,
      where: { id: { exists: true } },
      req,
      overrideAccess: true,
      context: { disableRevalidate: true },
      disableTransaction: true,
    })
  } else {
    await payload.db.deleteMany({ collection: collection as CollectionSlug, req, where: {} })
  }
  if (config.versions) await payload.db.deleteVersions({ collection: collection as CollectionSlug, req, where: {} })
}

/**
 * The seed engine. Takes the seed definitions, builds the model, validates references
 * against the live config, topologically sorts the dependency graph, clears the seeded
 * collections, uploads assets, creates docs (resolving ref/asset tokens to ids) in order,
 * and updates globals.
 */
export async function runSeed({ payload, req, options, definitions }: RunSeedArgs): Promise<SeedResult> {
  const defs = definitions ?? options.definitions ?? []
  if (defs.length === 0) payload.logger.warn('[payload-seed] no seed definitions: pass `definitions` to seedPlugin() or seed().')

  const { model, specs } = buildModel(defs)
  const collectionSlugs = new Set(Object.keys(payload.collections))

  // Valid top-level field names per node, read from the live config — for unknown-field
  // detection at runtime (the counterpart to the compile-time exactness check).
  const fieldNames = new Map<string, Set<string>>()
  for (const coll of model.collections) {
    const cfg = payload.collections[coll.slug as CollectionSlug]?.config
    if (cfg) fieldNames.set(coll.slug, new Set(cfg.flattenedFields.map((f) => f.name)))
  }
  for (const g of model.globals) {
    const cfg = payload.config.globals.find((gc) => gc.slug === g.slug)
    if (cfg) fieldNames.set(`global:${g.slug}`, new Set(cfg.flattenedFields.map((f) => f.name)))
  }

  // Validate references + fields, build/sort the dependency graph (cycle detection here).
  validateModel({ model, collectionSlugs, fieldNames })
  const { order } = buildGraph(model)

  const baseArgs = { depth: 0, overrideAccess: true, context: { disableRevalidate: true }, req } as const

  // Provider collections (e.g. mux-video) clear via payload.delete so their hooks fire
  // (the owning plugin's afterDelete removes the external asset).
  const providerCollections = new Set(options.assetProviders.map((p) => p.collection))

  // Clear: every collection we seed into, plus the asset upload collections.
  const assetCollections = new Set(Object.values(specs).map((s) => s.collection ?? options.assetsCollection))
  const seededCollections = [...new Set([...assetCollections, ...model.collections.map((c) => c.slug)])]
  payload.logger.info('[payload-seed] clearing collections...')
  for (const slug of seededCollections) await clearCollection(payload, req, slug, providerCollections.has(slug))

  // Upload image assets first; resolve provider source files (e.g. videos) to absolute paths.
  payload.logger.info('[payload-seed] uploading assets...')
  const assetIds = await uploadAssets({ payload, req, specs, assetsRoot: options.assetsDir, defaultCollection: options.assetsCollection })
  const sourceRefs = [
    ...model.collections.flatMap((c) => c.records.flatMap((r) => collectSourceRefs(r.data))),
    ...model.globals.flatMap((g) => collectSourceRefs(g.data)),
  ]
  const sources = await resolveSourceFiles({ payload, refs: sourceRefs, providers: options.assetProviders, assetsRoot: options.assetsDir })

  // Create docs in dependency order, resolving tokens to ids.
  const docIds = new Map<string, string | number>()
  const recordIndex = new Map<string, { slug: string; data: Record<string, unknown> }>()
  for (const coll of model.collections)
    for (const rec of coll.records) recordIndex.set(docNodeId(coll.slug, rec.key), { slug: coll.slug, data: rec.data })

  const created: Record<string, number> = {}
  if (assetIds.size) created[options.assetsCollection] = assetIds.size

  payload.logger.info('[payload-seed] seeding documents...')
  for (const nodeId of order) {
    const entry = recordIndex.get(nodeId)
    if (!entry) continue
    const data = resolveTokens(entry.data, { docs: docIds, assets: assetIds, sources, where: nodeId }) as Record<string, unknown>
    const doc = (await payload.create({ collection: entry.slug as CollectionSlug, data: data as never, ...baseArgs })) as {
      id: string | number
    }
    docIds.set(nodeId, doc.id)
    created[entry.slug] = (created[entry.slug] ?? 0) + 1
  }

  // Update globals after all docs exist.
  for (const g of model.globals) {
    payload.logger.info(`[payload-seed] seeding global '${g.slug}'`)
    const data = resolveTokens(g.data, { docs: docIds, assets: assetIds, sources, where: `global:${g.slug}` }) as Record<string, unknown>
    await payload.updateGlobal({ slug: g.slug as never, data: data as never, ...baseArgs })
  }

  payload.logger.info('[payload-seed] seed complete.')
  return { created, order }
}

/**
 * CLI / Local-API convenience: run the seed from a script (`payload run`) or test. Builds
 * a local `req` if one isn't supplied and resolves the public plugin options.
 */
export async function seed(args: { payload: Payload; req?: PayloadRequest; options?: SeedPluginOptions }): Promise<SeedResult> {
  const req = args.req ?? (await createLocalReq({}, args.payload))
  return runSeed({ payload: args.payload, req, options: resolveOptions(args.options) })
}
