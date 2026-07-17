import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { isRecord } from '../_kit'
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
  const data = isRecord(deepest) && isRecord(deepest.data) ? deepest.data : undefined
  const errors = data && Array.isArray(data.errors) ? data.errors : undefined
  if (errors?.length) {
    const fields = errors
      .map((e) => {
        const r = isRecord(e) ? e : {}
        const path = typeof r.path === 'string' ? r.path : typeof r.field === 'string' ? r.field : '?'
        return `${path}: ${typeof r.message === 'string' ? r.message : '?'}`
      })
      .join('; ')
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
    const doc = await payload.findByID({ collection: slug, id, req, depth: 0 })
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
    const raw = payload.collections[slug]?.config.custom?.seedAsset
    if (raw !== true && !isRecord(raw)) continue
    const sourceField = raw !== true && typeof raw.sourceField === 'string' ? raw.sourceField : 'source'
    const subdir = raw !== true && typeof raw.subdir === 'string' ? raw.subdir : undefined
    map.set(slug, { sourceField, subdir })
  }
  return map
}

function buildModel(definitions: SeedDefinition[]): BuiltModel {
  const collections: BuiltCollection[] = []
  const globals: BuiltGlobal[] = []

  for (const def of definitions) {
    if (def.kind === 'collection') {
      const records: BuiltRecord[] = def.build(tokens).map((rec) => {
        const { _key, _file, ...data } = isRecord(rec) ? rec : {}
        return { key: typeof _key === 'string' ? _key : '', file: isFileToken(_file) ? _file : undefined, data }
      })
      collections.push({ slug: def.slug, records })
    } else if (def.kind === 'global') {
      const built = def.build(tokens)
      globals.push({ slug: def.slug, data: isRecord(built) ? built : {} })
    }
  }

  return { collections, globals }
}

function partitionDefinitions(payload: Payload, defs: SeedDefinition[]): { active: SeedDefinition[]; skipped: SkippedDefinition[] } {
  const active: SeedDefinition[] = []
  const skipped: SkippedDefinition[] = []
  for (const def of defs) {
    const rawDisabled = def.kind === 'collection' ? payload.collections[def.slug]?.config.custom?.seedDisabled : undefined
    const fromCollection = typeof rawDisabled === 'boolean' || typeof rawDisabled === 'string' ? rawDisabled : undefined
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
  const config = payload.collections[collection]?.config
  if (!config) return
  payload.logger.info(`[payload-seed] clearing ${collection}`)
  const withHooks = Boolean(config.upload || config.hooks?.beforeDelete?.length || config.hooks?.afterDelete?.length)
  if (withHooks) {
    const result = await payload.delete({
      collection,
      where: { id: { exists: true } },
      req,
      context: { disableRevalidate: true },
      disableTransaction: true,
    })
    const failed: Array<{ label: string; reason: string }> = []
    for (const e of result?.errors ?? []) {
      if (e.id == null) continue
      try {
        await payload.delete({
          collection,
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
    await payload.db.deleteMany({ collection, req, where: {} })
  }
  if (config.versions) await payload.db.deleteVersions({ collection, req, where: {} })
}

export async function runSeed({ payload, req, options, definitions }: RunSeedArgs): Promise<SeedResult> {
  const defs = definitions ?? options.definitions ?? []
  if (defs.length === 0) payload.logger.warn('[payload-seed] no seed definitions: pass `definitions` to seedPlugin() or seed().')

  const { active, skipped } = partitionDefinitions(payload, defs)

  const model = buildModel(active)
  const collectionSlugs = new Set(Object.keys(payload.collections))

  const isUpload = (slug: string): boolean => Boolean(payload.collections[slug]?.config.upload)
  const assetBySlug = discoverAssetCollections(payload)

  const fileCollections = new Set<string>([...collectionSlugs].filter(isUpload))
  for (const slug of assetBySlug.keys()) fileCollections.add(slug)

  const fieldNames = new Map<string, Set<string>>()
  const requiredFields = new Map<string, Set<string>>()
  for (const coll of model.collections) {
    const cfg = payload.collections[coll.slug]?.config
    if (!cfg) continue
    fieldNames.set(coll.slug, new Set(cfg.flattenedFields.map((f) => f.name)))
    requiredFields.set(coll.slug, new Set(cfg.flattenedFields.filter((f) => 'required' in f && f.required).map((f) => f.name)))
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
    const resolved = resolveTokens(source, { docs: docIds, where: nodeId })
    let data: Record<string, unknown> = isRecord(resolved) ? resolved : {}
    let uploadFile: Awaited<ReturnType<typeof readFileAsUpload>> | undefined

    if (record.file) {
      const asset = assetBySlug.get(slug)
      const subdir = asset?.subdir ?? options.options.assetSubDirs[slug] ?? slug
      const subdirs = [subdir, '']
      const path = await resolveFilePath(record.file.name, options.options.assetsDir, subdirs)
      if (!path) {
        const searched = searchedDirs(record.file.name, options.options.assetsDir, subdirs).join(', ')
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
      doc = await payload.create({
        collection: slug,
        data,
        ...(uploadFile ? { file: uploadFile } : {}),
        ...baseArgs,
      })
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
        await payload.update({ collection: entry.slug, id, data: { [field]: value }, ...baseArgs })
      } catch (err) {
        throw new SeedRunError(`setting deferred field '${node}.${field}': ${deepestReason(err)}`)
      }
    }
  }

  for (const g of model.globals) {
    payload.logger.info(`[payload-seed] seeding global '${g.slug}'`)
    const resolvedGlobal = resolveTokens(g.data, { docs: docIds, where: `global:${g.slug}` })
    const data: Record<string, unknown> = isRecord(resolvedGlobal) ? resolvedGlobal : {}
    try {
      await payload.updateGlobal({ slug: g.slug, data, ...baseArgs })
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
