import { createHash } from 'node:crypto'

import type { CacheKeyDoc, ParsedParams } from '../../types'

export const variantCacheKey = (doc: CacheKeyDoc, p: ParsedParams, resolvedFormat: string): string => {
  const q = resolvedFormat === 'png' ? 0 : p.q
  // filesize keys same-filename byte replacement — in lockstep with detectVariantIdentityChange and deriveVersion.
  const parts = [
    String(doc.id),
    doc.filename ?? '',
    doc.filesize ?? '',
    p.w ?? '',
    p.h ?? '',
    p.fit,
    q,
    resolvedFormat,
    doc.focalX ?? 50,
    doc.focalY ?? 50,
  ]
  const hotspot = [doc.focalSize ?? 100, doc.cropLeft ?? 0, doc.cropTop ?? 0, doc.cropRight ?? 0, doc.cropBottom ?? 0]
  if (hotspot[0] !== 100 || hotspot.slice(1).some((v) => v !== 0)) parts.push(...hotspot)
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}
