import { isRef } from '../refs'
import type { BuiltModel } from './graph'
import { collectTokens, docNodeId } from './tokens'

export class SeedValidationError extends Error {
  constructor(public issues: string[]) {
    super(`[payload-seed] seed data failed validation:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
    this.name = 'SeedValidationError'
  }
}

export interface ValidateArgs {
  model: BuiltModel
  /** Slugs of collections that actually exist in the Payload config. */
  collectionSlugs: Set<string>
  /** Slugs of globals that actually exist in the Payload config. */
  globalSlugs: Set<string>
  /** Slugs that can carry a `_file`: upload collections plus `custom.seedAsset` collections. */
  fileCollections: Set<string>
  /** Valid top-level field names per node (`collection` slug, or `global:<slug>`), from the
   *  live config's `flattenedFields`. When provided, unknown record fields are flagged —
   *  the runtime counterpart to the compile-time exactness check. */
  fieldNames?: Map<string, Set<string>>
}

// Keys that are valid on a record but aren't schema fields.
const ALLOWED_NON_FIELDS = new Set(['_status'])

/**
 * Validate the built model against the declared docs and the live config: every definition's own
 * slug exists in the config (as a collection or global, matching its kind); every `ref()`
 * resolves to a seeded doc and references a real collection; every `_file` sits on a collection
 * that can take one (an upload or `custom.seedAsset` collection); no duplicate `_key` within a collection
 * (across every definition sharing the slug); and (when `fieldNames` is supplied) every record field
 * exists in the schema. Collects ALL issues and throws once. (Cycle detection happens in the graph topo-sort.)
 */
export function validateModel({ model, collectionSlugs, globalSlugs, fileCollections, fieldNames }: ValidateArgs): void {
  const issues: string[] = []
  const docIds = new Set<string>()
  for (const coll of model.collections) for (const rec of coll.records) docIds.add(docNodeId(coll.slug, rec.key))

  // A definition's own slug must exist in the config, or the run would wipe collections and then die mid-create.
  for (const coll of model.collections) {
    if (!collectionSlugs.has(coll.slug)) {
      issues.push(`defineSeed('${coll.slug}'): no collection '${coll.slug}' in the Payload config - fix the slug or add the collection.`)
    }
  }
  for (const g of model.globals) {
    if (!globalSlugs.has(g.slug)) {
      issues.push(`defineSeed('${g.slug}'): no global '${g.slug}' in the Payload config - fix the slug or add the global.`)
    }
  }

  const check = (where: string, data: unknown) => {
    for (const token of collectTokens(data)) {
      if (!isRef(token)) continue
      if (!collectionSlugs.has(token.collection)) {
        issues.push(`${where}: ref('${token.collection}', '${token.key}') targets unknown collection '${token.collection}'.`)
      } else if (!docIds.has(docNodeId(token.collection, token.key))) {
        issues.push(`${where}: ref('${token.collection}', '${token.key}') - no seeded '${token.collection}' doc has _key '${token.key}'.`)
      }
    }
  }

  for (const coll of model.collections) for (const rec of coll.records) check(`${coll.slug}:${rec.key}`, rec.data)
  for (const g of model.globals) check(`global:${g.slug}`, g.data)

  // A `_file` only makes sense on an upload collection or a `custom.seedAsset` collection.
  for (const coll of model.collections) {
    for (const rec of coll.records) {
      if (rec.file && !fileCollections.has(coll.slug)) {
        issues.push(`${coll.slug}:${rec.key}: _file set, but '${coll.slug}' is not an upload collection or a custom.seedAsset collection.`)
      }
    }
  }

  // Unknown top-level fields (runtime counterpart to the compile-time exactness check).
  const checkFields = (where: string, slug: string, data: Record<string, unknown>) => {
    const valid = fieldNames?.get(slug)
    if (!valid) return
    for (const key of Object.keys(data)) {
      if (!valid.has(key) && !ALLOWED_NON_FIELDS.has(key)) issues.push(`${where}: unknown field '${key}' - not in the '${slug}' schema.`)
    }
  }
  for (const coll of model.collections) for (const rec of coll.records) checkFields(`${coll.slug}:${rec.key}`, coll.slug, rec.data)
  for (const g of model.globals) checkFields(`global:${g.slug}`, `global:${g.slug}`, g.data)

  // Duplicate _key within a collection makes refs ambiguous - checked across every definition sharing the slug.
  const seenBySlug = new Map<string, Set<string>>()
  for (const coll of model.collections) {
    const seen = seenBySlug.get(coll.slug) ?? new Set<string>()
    seenBySlug.set(coll.slug, seen)
    for (const rec of coll.records) {
      if (seen.has(rec.key)) issues.push(`${coll.slug}: duplicate _key '${rec.key}'.`)
      seen.add(rec.key)
    }
  }

  if (issues.length) throw new SeedValidationError(issues)
}
