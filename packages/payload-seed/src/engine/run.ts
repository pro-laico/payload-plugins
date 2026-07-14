import { type CollectionSlug, createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { buildGraph } from './graph'
import { resolveOptions } from '../options'
import { notifyAfterSeed } from '../listeners'
import { file, isFileToken, isRef, ref } from '../refs'
import { collectTokens, docNodeId, resolveTokens } from './tokens'
import { resolveFilePath, readFileAsUpload, searchedDirs } from './files'
import { SeedRunError, SeedValidationError, validateModel } from './validate'
import type {
  AssetCollection,
  BuiltCollection,
  BuiltGlobal,
  BuiltModel,
  BuiltRecord,
  RunSeedArgs,
  SeedAssetMarker,
  SeedDefinition,
  SeedDisabledMarker,
  SeedPluginOptions,
  SeedResult,
  SkippedDefinition,
} from '../types'

function deepestReason(err: unknown, fallback?: string): string {
  let deepest = err instanceof Error ? err : undefined
  while (deepest?.cause instanceof Error) deepest = deepest.cause
  let msg = deepest?.message ?? fallback ?? String(err)
  //TODO: replace `as` cast with proper typing
  const data = (deepest as undefined | { data?: { errors?: Array<{ path?: string; field?: string; message?: string }> } })?.data
  if (data?.errors?.length) {
    const fields = data.errors.map((e) => `${e.path ?? e.field ?? '?'}: ${e.message ?? '?'}`).join('; ')
    msg = `${msg} — ${fields}`
  }
  return msg.replace(/\s+/g, ' ').slice(0, 300)
}

async function describeFailedDoc(
  payload: Payload,
  req: PayloadRequest,
  slug: string,
  useAsTitle: string | undefined,
  id: string | number,
): Promise<string> {
  try {
    //TODO: replace `as` casts with proper typing
    const doc = (await payload.findByID({ collection: slug as CollectionSlug, id, req, depth: 0 })) as unknown as Record<string, unknown>
    const label = [useAsTitle ? doc[useAsTitle] : undefined, doc.title, doc.name, doc.slug, doc.filename].find(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    )
    if (label) return `"${label}" [${id}]`
  } catch {}
  return `[${id}]`
}

const tokens = { ref, file }

function discoverAssetCollections(payload: Payload): Map<string, AssetCollection> {
  const map = new Map<string, AssetCollection>()
  for (const slug of Object.keys(payload.collections)) {
    //TODO: replace `as` casts with proper typing
    const marker = payload.collections[slug as CollectionSlug]?.config.custom?.seedAsset as SeedAssetMarker | undefined
    if (!marker) continue
    const m = marker === true ? {} : marker
    map.set(slug, { sourceField: m.sourceField ?? 'source', subdir: m.subdir })
  }
  return map
}

function buildModel(definitions: SeedDefinition[]): BuiltModel {
  const collections: BuiltCollection[] = []
  const globals: BuiltGlobal[] = []

  for (const def of definitions) {
    if (def.kind === 'collection') {
      const records: BuiltRecord[] = def.build(tokens).map((rec) => {
        //TODO: replace `as` cast with proper typing
        const { _key, _file, ...data } = rec as { _key: string; _file?: unknown } & Record<string, unknown>
        return { key: _key, file: isFileToken(_file) ? _file : undefined, data }
      })
      collections.push({ slug: def.slug, records })
    } else if (def.kind === 'global') {
      globals.push({ slug: def.slug, data: def.build(tokens) as Record<string, unknown> }) //TODO: replace `as` cast with proper typing
    }
  }

  return { collections, globals }
}

function partitionDefinitions(payload: Payload, defs: SeedDefinition[]): { active: SeedDefinition[]; skipped: SkippedDefinition[] } {
  const active: SeedDefinition[] = []
  const skipped: SkippedDefinition[] = []
  for (const def of defs) {
    //TODO: replace `as` casts with proper typing
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

function stripRefsToSkipped(payload: Payload, model: BuiltModel, skipped: SkippedDefinition[], requiredFields: Map<string, Set<string>>): void {
  if (!skipped.length) return
  const issues: string[] = []
  const reasonBySlug = new Map(skipped.map((s) => [s.slug, s.reason]))

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
      payload.logger.warn(
        `[payload-seed] dropping entire field '${field}' on ${where} (contains ref('${hit.collection}', '${hit.key}') to skipped '${hit.collection}': ${reasonBySlug.get(hit.collection)}).`,
      )
    }
  }

  for (const coll of model.collections) for (const rec of coll.records) strip(docNodeId(coll.slug, rec.key), coll.slug, rec.data)
  for (const g of model.globals) strip(`global:${g.slug}`, undefined, g.data)

  if (issues.length) throw new SeedValidationError(issues)
}

async function clearCollection(payload: Payload, req: PayloadRequest, collection: string): Promise<void> {
  const config = payload.collections[collection as CollectionSlug]?.config //TODO: replace `as` cast with proper typing
  if (!config) return
  payload.logger.info(`[payload-seed] clearing ${collection}`)
  const withHooks = Boolean(config.upload || config.hooks?.beforeDelete?.length || config.hooks?.afterDelete?.length)
  if (withHooks) {
    //TODO: replace `as` casts with proper typing
    const result = (await payload.delete({
      collection: collection as CollectionSlug,
      where: { id: { exists: true } },
      req,
      context: { disableRevalidate: true },
      disableTransaction: true,
    })) as { errors?: Array<{ id?: string | number; message?: string }> }
    const failed: Array<{ label: string; reason: string }> = []
    for (const e of result?.errors ?? []) {
      if (e.id == null) continue
      try {
        //TODO: replace `as` cast with proper typing
        await payload.delete({
          collection: collection as CollectionSlug,
          id: e.id,
          req,
          context: { disableRevalidate: true },
          disableTransaction: true,
        })
      } catch (err) {
        const reason = deepestReason(err, e.message)
        const label = await describeFailedDoc(payload, req, collection, config.admin?.useAsTitle, e.id)
        failed.push({ label, reason })
      }
    }
    if (failed.length) {
      const detail = failed.map((f) => `${f.label}: ${f.reason}`).join(' | ')
      payload.logger.warn(
        `[payload-seed] could not clear ${failed.length} doc(s) in '${collection}' — these STALE docs now sit beside the fresh seed; re-run the seed or delete them in the admin. Reasons: ${detail}`,
      )
    }
  } else {
    await payload.db.deleteMany({ collection: collection as CollectionSlug, req, where: {} }) //TODO: replace `as` cast with proper typing
  }
  //TODO: replace `as` cast with proper typing
  if (config.versions) await payload.db.deleteVersions({ collection: collection as CollectionSlug, req, where: {} })
}

export async function runSeed({ payload, req, options, definitions }: RunSeedArgs): Promise<SeedResult> {
  const defs = definitions ?? options.definitions ?? []
  if (defs.length === 0) payload.logger.warn('[payload-seed] no seed definitions: pass `definitions` to seedPlugin() or seed().')

  const { active, skipped } = partitionDefinitions(payload, defs)

  const model = buildModel(active)
  const collectionSlugs = new Set(Object.keys(payload.collections))

  const isUpload = (slug: string): boolean => Boolean(payload.collections[slug as CollectionSlug]?.config.upload)
  const assetBySlug = discoverAssetCollections(payload)

  const fileCollections = new Set<string>([...collectionSlugs].filter(isUpload))
  for (const slug of assetBySlug.keys()) fileCollections.add(slug)

  const fieldNames = new Map<string, Set<string>>()
  const requiredFields = new Map<string, Set<string>>()
  for (const coll of model.collections) {
    const cfg = payload.collections[coll.slug as CollectionSlug]?.config
    if (!cfg) continue
    fieldNames.set(coll.slug, new Set(cfg.flattenedFields.map((f) => f.name)))
    //TODO: replace `as` cast with proper typing
    requiredFields.set(coll.slug, new Set(cfg.flattenedFields.filter((f) => (f as { required?: boolean }).required).map((f) => f.name)))
  }
  for (const g of model.globals) {
    const cfg = payload.config.globals.find((gc) => gc.slug === g.slug)
    if (cfg) fieldNames.set(`global:${g.slug}`, new Set(cfg.flattenedFields.map((f) => f.name)))
  }

  stripRefsToSkipped(payload, model, skipped, requiredFields)

  const globalSlugs = new Set(payload.config.globals.map((g) => g.slug))
  validateModel({ model, collectionSlugs, globalSlugs, fileCollections, fieldNames })
  const isRequired = (collection: string, field: string): boolean => requiredFields.get(collection)?.has(field) ?? false
  const { order, deferred } = buildGraph(model, { isRequired })

  const deferredByNode = new Map<string, Set<string>>()
  for (const d of deferred) {
    const set = deferredByNode.get(d.node) ?? new Set<string>()
    set.add(d.field)
    deferredByNode.set(d.node, set)
  }

  const baseArgs = { depth: 0, context: { disableRevalidate: true }, req } as const

  const docIds = new Map<string, string | number>()
  const recordIndex = new Map<string, { slug: string; record: BuiltRecord }>()
  for (const coll of model.collections)
    for (const rec of coll.records) recordIndex.set(docNodeId(coll.slug, rec.key), { slug: coll.slug, record: rec })

  const seededCollections = [...new Set(model.collections.map((c) => c.slug))]
  const creationOrder: string[] = []
  const seen = new Set<string>()
  for (const nodeId of order) {
    const slug = recordIndex.get(nodeId)?.slug
    if (slug && !seen.has(slug)) {
      seen.add(slug)
      creationOrder.push(slug)
    }
  }
  for (const slug of seededCollections) if (!seen.has(slug)) creationOrder.push(slug)
  payload.logger.info('[payload-seed] clearing collections...')
  for (const slug of [...creationOrder].reverse()) await clearCollection(payload, req, slug)

  const created: Record<string, number> = {}

  payload.logger.info('[payload-seed] seeding documents...')
  for (const nodeId of order) {
    const entry = recordIndex.get(nodeId)
    if (!entry) continue
    const { slug, record } = entry
    const deferFields = deferredByNode.get(nodeId)
    const source = deferFields ? Object.fromEntries(Object.entries(record.data).filter(([k]) => !deferFields.has(k))) : record.data
    let data = resolveTokens(source, { docs: docIds, where: nodeId }) as Record<string, unknown> //TODO: replace `as` cast with proper typing
    let uploadFile: Awaited<ReturnType<typeof readFileAsUpload>> | undefined

    if (record.file) {
      const asset = assetBySlug.get(slug)
      const subdir = asset?.subdir ?? options.assetSubDirs[slug] ?? slug
      const subdirs = [subdir, '']
      const path = await resolveFilePath(record.file.name, options.assetsDir, subdirs)
      if (!path) {
        const searched = searchedDirs(record.file.name, options.assetsDir, subdirs).join(', ')
        payload.logger.warn({ msg: `[payload-seed] ${nodeId}: _file '${record.file.name}' not found - skipped. Searched: ${searched}` })
      } else if (asset) {
        data = { ...data, [asset.sourceField]: { file: path, ...record.file.options } }
      } else if (isUpload(slug)) {
        uploadFile = await readFileAsUpload(path)
      }
    }

    payload.logger.info(`[payload-seed] seeding '${nodeId}'`)
    let doc: { id: string | number }
    try {
      //TODO: replace `as` casts with proper typing
      doc = (await payload.create({
        collection: slug as CollectionSlug,
        data: data as never,
        ...(uploadFile ? { file: uploadFile } : {}),
        ...baseArgs,
      })) as { id: string | number }
    } catch (err) {
      throw new SeedRunError(`creating '${nodeId}': ${deepestReason(err)}`)
    }
    docIds.set(nodeId, doc.id)
    created[slug] = (created[slug] ?? 0) + 1
  }

  if (deferred.length) {
    payload.logger.info(`[payload-seed] resolving ${deferred.length} deferred reference(s)...`)
    for (const { node, field } of deferred) {
      const entry = recordIndex.get(node)
      const id = docIds.get(node)
      if (!entry || id === undefined) continue
      const value = resolveTokens(entry.record.data[field], { docs: docIds, where: `${node}.${field}` })
      try {
        //TODO: replace `as` casts with proper typing
        await payload.update({ collection: entry.slug as CollectionSlug, id, data: { [field]: value } as never, ...baseArgs })
      } catch (err) {
        throw new SeedRunError(`setting deferred field '${node}.${field}': ${deepestReason(err)}`)
      }
    }
  }

  for (const g of model.globals) {
    payload.logger.info(`[payload-seed] seeding global '${g.slug}'`)
    //TODO: replace `as` cast with proper typing
    const data = resolveTokens(g.data, { docs: docIds, where: `global:${g.slug}` }) as Record<string, unknown>
    try {
      await payload.updateGlobal({ slug: g.slug as never, data: data as never, ...baseArgs }) //TODO: replace `as` casts with proper typing
    } catch (err) {
      throw new SeedRunError(`updating global '${g.slug}': ${deepestReason(err)}`)
    }
  }

  payload.logger.info('[payload-seed] seed complete.')
  const result: SeedResult = {
    created,
    collections: model.collections.map((c) => c.slug),
    globals: model.globals.map((g) => g.slug),
    order,
    deferred,
    skipped,
  }
  await notifyAfterSeed(payload, req, result)
  return result
}

export async function seed(args: { payload: Payload; req?: PayloadRequest; options?: SeedPluginOptions }): Promise<SeedResult> {
  const req = args.req ?? (await createLocalReq({}, args.payload))
  return runSeed({ payload: args.payload, req, options: resolveOptions(args.options) })
}
