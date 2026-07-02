import { type CollectionSlug, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { resolveOptions, type ResolvedSeedOptions, type SeedPluginOptions } from '../options'
import { file, isFileToken, isRef, ref } from '../refs'
import type { SeedAssetMarker, SeedDefinition, SeedDisabledMarker } from '../types'
import { type BuiltCollection, type BuiltGlobal, type BuiltModel, type BuiltRecord, buildGraph, type DeferredField } from './graph'
import { resolveFilePath, readFileAsUpload } from './files'
import { collectTokens, docNodeId, resolveTokens } from './tokens'
import { SeedValidationError, validateModel } from './validate'

export interface SeedResult {
  /** Created doc counts keyed by collection slug. */
  created: Record<string, number>
  /** The computed topological create order (doc node ids, `collection:_key`). */
  order: string[]
  /** Fields deferred to break a `ref` cycle: created null, then set in a second pass. */
  deferred: DeferredField[]
  /** Definitions skipped this run (their own `disabled`, or the collection's `custom.seedDisabled`). */
  skipped: SkippedDefinition[]
}

export interface SkippedDefinition {
  slug: string
  reason: string
}

export interface RunSeedArgs {
  payload: Payload
  req: PayloadRequest
  options: ResolvedSeedOptions
  /** Seed definitions. Falls back to `options.definitions` when omitted. */
  definitions?: SeedDefinition[]
}

const tokens = { ref, file }

/** A `custom.seedAsset` collection, resolved to its effective source field (subdir defaults are
 *  applied at lookup, alongside `assetSubDirs`, so they match native uploads). */
interface AssetCollection {
  sourceField: string
  subdir?: string
}

/** Discover asset collections from the live config: any collection whose `custom.seedAsset` is set.
 *  A `_file` on one of these is handed to the collection's ingest hook via `sourceField` instead of
 *  uploaded as bytes. Replaces the old `assetProviders` plugin option — declaration now lives on the
 *  collection, so the seed plugin needs no knowledge of the owning plugins. */
function discoverAssetCollections(payload: Payload): Map<string, AssetCollection> {
  const map = new Map<string, AssetCollection>()
  for (const slug of Object.keys(payload.collections)) {
    const marker = payload.collections[slug as CollectionSlug]?.config.custom?.seedAsset as SeedAssetMarker | undefined
    if (!marker) continue
    const m = marker === true ? {} : marker
    map.set(slug, { sourceField: m.sourceField ?? 'source', subdir: m.subdir })
  }
  return map
}

/** Split definitions by kind and build the concrete model (records + their `_file`, and globals). */
function buildModel(definitions: SeedDefinition[]): BuiltModel {
  const collections: BuiltCollection[] = []
  const globals: BuiltGlobal[] = []

  for (const def of definitions) {
    if (def.kind === 'collection') {
      const records: BuiltRecord[] = def.build(tokens).map((rec) => {
        const { _key, _file, ...data } = rec as { _key: string; _file?: unknown } & Record<string, unknown>
        return { key: _key, file: isFileToken(_file) ? _file : undefined, data }
      })
      collections.push({ slug: def.slug, records })
    } else if (def.kind === 'global') {
      globals.push({ slug: def.slug, data: def.build(tokens) as Record<string, unknown> })
    }
  }

  return { collections, globals }
}

/** Split definitions into runnable and skipped. A definition is skipped when its own `disabled` is
 *  set, or when its target collection declares `custom.seedDisabled` (e.g. a plugin detecting
 *  missing credentials at config time). Skipped definitions still shaped the generated seed-ref
 *  types — only the run drops them, so types stay stable across environments. */
function partitionDefinitions(payload: Payload, defs: SeedDefinition[]): { active: SeedDefinition[]; skipped: SkippedDefinition[] } {
  const active: SeedDefinition[] = []
  const skipped: SkippedDefinition[] = []
  for (const def of defs) {
    const fromCollection =
      def.kind === 'collection'
        ? (payload.collections[def.slug as CollectionSlug]?.config.custom?.seedDisabled as SeedDisabledMarker | undefined)
        : undefined
    const flag = def.disabled || fromCollection
    if (!flag) {
      active.push(def)
      continue
    }
    const reason = typeof flag === 'string' ? flag : 'disabled'
    skipped.push({ slug: def.slug, reason })
    payload.logger.warn(`[payload-seed] skipping '${def.slug}': ${reason}`)
  }
  return { active, skipped }
}

/** Drop every optional field whose value contains a `ref()` into a skipped collection (warning per
 *  drop — the doc won't exist this run), and hard-error when such a ref sits on a required field.
 *  Runs before validation, so the remaining model checks clean. */
function stripRefsToSkipped(payload: Payload, model: BuiltModel, skipped: SkippedDefinition[], requiredFields: Map<string, Set<string>>): void {
  if (!skipped.length) return
  const reasonBySlug = new Map(skipped.map((s) => [s.slug, s.reason]))
  const issues: string[] = []

  const strip = (where: string, slug: string | undefined, data: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(data)) {
      const hit = collectTokens(value).find((t) => isRef(t) && reasonBySlug.has(t.collection))
      if (!hit || !isRef(hit)) continue
      if (slug && requiredFields.get(slug)?.has(field)) {
        issues.push(
          `${where}.${field}: required, but ref('${hit.collection}', '${hit.key}') targets a skipped definition (${reasonBySlug.get(hit.collection)}).`,
        )
        continue
      }
      delete data[field]
      payload.logger.warn(`[payload-seed] dropping '${where}.${field}': ref('${hit.collection}', '${hit.key}') targets a skipped definition.`)
    }
  }

  for (const coll of model.collections) for (const rec of coll.records) strip(docNodeId(coll.slug, rec.key), coll.slug, rec.data)
  for (const g of model.globals) strip(`global:${g.slug}`, undefined, g.data)

  if (issues.length) throw new SeedValidationError(issues)
}

async function clearCollection(payload: Payload, req: PayloadRequest, collection: string): Promise<void> {
  const config = payload.collections[collection as CollectionSlug]?.config
  if (!config) return
  payload.logger.info(`[payload-seed] clearing ${collection}`)
  // Delete via the Local API (firing hooks) when clearing must cascade — an upload collection (to
  // remove stored bytes) or any collection with a before/after-delete hook (e.g. `mux-video`'s Mux
  // cleanup, `font`'s cascade to its originals + optimized). Otherwise wipe rows directly.
  const withHooks = Boolean(config.upload || config.hooks?.beforeDelete?.length || config.hooks?.afterDelete?.length)
  if (withHooks) {
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
 * The seed engine. Takes the seed definitions, skips the disabled ones (their own `disabled`, or
 * the collection's `custom.seedDisabled` — dropping optional refs that point at them), builds the
 * model, validates references against the live config, topologically sorts the dependency graph,
 * clears the seeded collections, then creates docs in order — resolving `ref` tokens to ids and
 * delivering each doc's `_file` as a native upload (upload collections) or a source-field value
 * (`custom.seedAsset` collections). A `ref` cycle is broken by deferring an optional field, which a
 * second pass sets once every doc exists (a cycle with only required fields is a hard error).
 * Globals are updated last.
 */
export async function runSeed({ payload, req, options, definitions }: RunSeedArgs): Promise<SeedResult> {
  const defs = definitions ?? options.definitions ?? []
  if (defs.length === 0) payload.logger.warn('[payload-seed] no seed definitions: pass `definitions` to seedPlugin() or seed().')

  // Drop disabled definitions (their own `disabled`, or the collection's `custom.seedDisabled` —
  // e.g. payload-mux without credentials). They still shaped the generated seed-ref types.
  const { active, skipped } = partitionDefinitions(payload, defs)

  const model = buildModel(active)
  const collectionSlugs = new Set(Object.keys(payload.collections))

  const isUpload = (slug: string): boolean => Boolean(payload.collections[slug as CollectionSlug]?.config.upload)
  const assetBySlug = discoverAssetCollections(payload)

  // Collections a `_file` may sit on: every upload collection plus every `custom.seedAsset` collection.
  const fileCollections = new Set<string>([...collectionSlugs].filter(isUpload))
  for (const slug of assetBySlug.keys()) fileCollections.add(slug)

  // Valid top-level field names per node (for unknown-field detection) plus the required ones (so a
  // ref cycle can only be broken by deferring an optional field) — read from the live config.
  const fieldNames = new Map<string, Set<string>>()
  const requiredFields = new Map<string, Set<string>>()
  for (const coll of model.collections) {
    const cfg = payload.collections[coll.slug as CollectionSlug]?.config
    if (!cfg) continue
    fieldNames.set(coll.slug, new Set(cfg.flattenedFields.map((f) => f.name)))
    requiredFields.set(coll.slug, new Set(cfg.flattenedFields.filter((f) => (f as { required?: boolean }).required).map((f) => f.name)))
  }
  for (const g of model.globals) {
    const cfg = payload.config.globals.find((gc) => gc.slug === g.slug)
    if (cfg) fieldNames.set(`global:${g.slug}`, new Set(cfg.flattenedFields.map((f) => f.name)))
  }

  // Refs into a skipped definition come out of the data before validation: dropped when the field
  // is optional (the run warns; re-seed once the skip is lifted and they fill in), fatal when it's
  // required (the doc can't be created without it).
  stripRefsToSkipped(payload, model, skipped, requiredFields)

  validateModel({ model, collectionSlugs, fileCollections, fieldNames })
  const isRequired = (collection: string, field: string): boolean => requiredFields.get(collection)?.has(field) ?? false
  const { order, deferred } = buildGraph(model, { isRequired })

  // Fields nulled at create time (their refs point into a cycle) and set in a second pass below.
  const deferredByNode = new Map<string, Set<string>>()
  for (const d of deferred) {
    const set = deferredByNode.get(d.node) ?? new Set<string>()
    set.add(d.field)
    deferredByNode.set(d.node, set)
  }

  const baseArgs = { depth: 0, overrideAccess: true, context: { disableRevalidate: true }, req } as const

  // Clear every seeded collection. `clearCollection` fires delete hooks when the collection needs
  // a cascade (uploads / external-asset cleanup); plain collections are wiped directly.
  const seededCollections = [...new Set(model.collections.map((c) => c.slug))]
  payload.logger.info('[payload-seed] clearing collections...')
  for (const slug of seededCollections) await clearCollection(payload, req, slug)

  // Create docs in dependency order, resolving ref tokens to ids and delivering each `_file`.
  const docIds = new Map<string, string | number>()
  const recordIndex = new Map<string, { slug: string; record: BuiltRecord }>()
  for (const coll of model.collections)
    for (const rec of coll.records) recordIndex.set(docNodeId(coll.slug, rec.key), { slug: coll.slug, record: rec })

  const created: Record<string, number> = {}

  payload.logger.info('[payload-seed] seeding documents...')
  for (const nodeId of order) {
    const entry = recordIndex.get(nodeId)
    if (!entry) continue
    const { slug, record } = entry
    // Drop any deferred fields before resolving: their refs point into a cycle and aren't created
    // yet. The second pass below sets them once every doc exists.
    const deferFields = deferredByNode.get(nodeId)
    const source = deferFields ? Object.fromEntries(Object.entries(record.data).filter(([k]) => !deferFields.has(k))) : record.data
    let data = resolveTokens(source, { docs: docIds, where: nodeId }) as Record<string, unknown>
    let uploadFile: Awaited<ReturnType<typeof readFileAsUpload>> | undefined

    if (record.file) {
      // Both branches resolve the file the same way — under the per-collection subdir (a
      // `custom.seedAsset` `subdir`, else `assetSubDirs`, else the slug), then the assets root.
      const asset = assetBySlug.get(slug)
      const subdir = asset?.subdir ?? options.assetSubDirs[slug] ?? slug
      const path = await resolveFilePath(record.file.name, options.assetsDir, [subdir, ''])
      if (!path) {
        payload.logger.warn({ msg: `[payload-seed] ${nodeId}: _file '${record.file.name}' not found under ${options.assetsDir} - skipped` })
      } else if (asset) {
        // Hand the resolved path + options to the collection's ingest hook via its source field
        // instead of uploading bytes.
        data = { ...data, [asset.sourceField]: { file: path, ...record.file.options } }
      } else if (isUpload(slug)) {
        uploadFile = await readFileAsUpload(path)
      }
    }

    payload.logger.info(`[payload-seed] seeding '${nodeId}'`)
    const doc = (await payload.create({
      collection: slug as CollectionSlug,
      data: data as never,
      ...(uploadFile ? { file: uploadFile } : {}),
      ...baseArgs,
    })) as { id: string | number }
    docIds.set(nodeId, doc.id)
    created[slug] = (created[slug] ?? 0) + 1
  }

  // Second pass: now every doc exists, resolve and set the fields deferred to break cycles.
  if (deferred.length) {
    payload.logger.info(`[payload-seed] resolving ${deferred.length} deferred reference(s)...`)
    for (const { node, field } of deferred) {
      const entry = recordIndex.get(node)
      const id = docIds.get(node)
      if (!entry || id === undefined) continue
      const value = resolveTokens(entry.record.data[field], { docs: docIds, where: `${node}.${field}` })
      await payload.update({ collection: entry.slug as CollectionSlug, id, data: { [field]: value } as never, ...baseArgs })
    }
  }

  // Update globals after all docs exist.
  for (const g of model.globals) {
    payload.logger.info(`[payload-seed] seeding global '${g.slug}'`)
    const data = resolveTokens(g.data, { docs: docIds, where: `global:${g.slug}` }) as Record<string, unknown>
    await payload.updateGlobal({ slug: g.slug as never, data: data as never, ...baseArgs })
  }

  payload.logger.info('[payload-seed] seed complete.')
  return { created, order, deferred, skipped }
}

/**
 * CLI / Local-API convenience: run the seed from a script (`payload run`) or test. Builds
 * a local `req` if one isn't supplied and resolves the public plugin options.
 */
export async function seed(args: { payload: Payload; req?: PayloadRequest; options?: SeedPluginOptions }): Promise<SeedResult> {
  const req = args.req ?? (await createLocalReq({}, args.payload))
  return runSeed({ payload: args.payload, req, options: resolveOptions(args.options) })
}
