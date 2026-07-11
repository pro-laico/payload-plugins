/**
 * Deterministic cache key for a generated variant: source identity (`id` + `filename` + focal +
 * hotspot) plus the transform params and resolved format. Keyed on `filename`, not `updatedAt`,
 * to match exactly what `purgeStaleVariantsAfterChange` triggers on — a metadata-only edit keeps
 * the stored variants valid, and keys go stale in lockstep with the purge hook.
 */
import { createHash } from 'node:crypto'

import type { CacheKeyDoc, ParsedParams } from '../../types'

export const variantCacheKey = (doc: CacheKeyDoc, p: ParsedParams, resolvedFormat: string): string => {
  const q = resolvedFormat === 'png' ? 0 : p.q
  const parts = [String(doc.id), doc.filename ?? '', p.w ?? '', p.h ?? '', p.fit, q, resolvedFormat, doc.focalX ?? 50, doc.focalY ?? 50]
  const hotspot = [doc.focalSize ?? 100, doc.cropLeft ?? 0, doc.cropTop ?? 0, doc.cropRight ?? 0, doc.cropBottom ?? 0]
  if (hotspot[0] !== 100 || hotspot.slice(1).some((v) => v !== 0)) parts.push(...hotspot)
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}
