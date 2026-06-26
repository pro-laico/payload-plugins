import { isAssetRef, isRef } from '../refs'
import type { BuiltModel } from './graph'
import { collectTokens, docNodeId } from './tokens'

export class SeedValidationError extends Error {
  constructor(public issues: string[]) {
    super(`[payload-seed] seed data failed validation:\n${issues.map((i) => `  • ${i}`).join('\n')}`)
    this.name = 'SeedValidationError'
  }
}

export interface ValidateArgs {
  model: BuiltModel
  /** Slugs of collections that actually exist in the Payload config. */
  collectionSlugs: Set<string>
}

/**
 * Validate the built model against the declared docs/assets and the live config: every
 * `ref()` resolves to a seeded doc, references a real collection; every `asset()` resolves
 * to a declared asset. Collects ALL issues and throws once. (Cycle detection happens in
 * the graph topo-sort.)
 */
export function validateModel({ model, collectionSlugs }: ValidateArgs): void {
  const issues: string[] = []
  const docIds = new Set<string>()
  for (const coll of model.collections) for (const rec of coll.records) docIds.add(docNodeId(coll.slug, rec.key))
  const assetKeys = new Set(model.assetKeys)

  const check = (where: string, data: unknown) => {
    for (const token of collectTokens(data)) {
      if (isRef(token)) {
        if (!collectionSlugs.has(token.collection)) {
          issues.push(`${where}: ref('${token.collection}', '${token.key}') targets unknown collection '${token.collection}'.`)
        } else if (!docIds.has(docNodeId(token.collection, token.key))) {
          issues.push(`${where}: ref('${token.collection}', '${token.key}') — no seeded '${token.collection}' doc has _key '${token.key}'.`)
        }
      } else if (isAssetRef(token) && !assetKeys.has(token.key)) {
        issues.push(`${where}: asset('${token.key}') — no asset is declared with that key.`)
      }
    }
  }

  for (const coll of model.collections) for (const rec of coll.records) check(`${coll.slug}:${rec.key}`, rec.data)
  for (const g of model.globals) check(`global:${g.slug}`, g.data)

  // Duplicate _key within a collection makes refs ambiguous.
  for (const coll of model.collections) {
    const seen = new Set<string>()
    for (const rec of coll.records) {
      if (seen.has(rec.key)) issues.push(`${coll.slug}: duplicate _key '${rec.key}'.`)
      seen.add(rec.key)
    }
  }

  if (issues.length) throw new SeedValidationError(issues)
}
