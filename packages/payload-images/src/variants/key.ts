/**
 * Deterministic cache key for a generated variant. Folds in the source identity
 * (`id` + `filename`) + focal point so a re-upload or focal edit yields a new key,
 * and the transform params + the *resolved* output format so each distinct render
 * is its own variant.
 *
 * Keying on `filename` (not `updatedAt`) deliberately matches what
 * `purgeStaleVariantsAfterChange` triggers on — a file replacement or focal edit.
 * So a metadata-only edit (e.g. `alt`) bumps `updatedAt` but leaves the key (and the
 * stored variants) intact: keys go stale exactly when the purge hook also fires, so
 * unreachable variants are removed in lockstep rather than orphaned.
 */
import { createHash } from 'node:crypto'

import type { ParsedParams } from '../transform/params'

export interface CacheKeyDoc {
  id: string | number
  filename?: string | null
  focalX?: number | null
  focalY?: number | null
  focalSize?: number | null
  cropLeft?: number | null
  cropTop?: number | null
  cropRight?: number | null
  cropBottom?: number | null
}

export const variantCacheKey = (doc: CacheKeyDoc, p: ParsedParams, resolvedFormat: string): string => {
  const q = resolvedFormat === 'png' ? 0 : p.q
  const parts = [String(doc.id), doc.filename ?? '', p.w ?? '', p.h ?? '', p.fit, q, resolvedFormat, doc.focalX ?? 50, doc.focalY ?? 50]
  // Hotspot layers join the key ONLY when set off their defaults: an all-defaults doc keys
  // byte-identically to the pre-hotspot format, so existing cached variants survive the upgrade.
  const hotspot = [doc.focalSize ?? 100, doc.cropLeft ?? 0, doc.cropTop ?? 0, doc.cropRight ?? 0, doc.cropBottom ?? 0]
  if (hotspot[0] !== 100 || hotspot.slice(1).some((v) => v !== 0)) parts.push(...hotspot)
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}
