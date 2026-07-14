import type { CollectionConfig } from 'payload'

import { isRecord } from '../isRecord'

export const mergeSelect = (
  base: CollectionConfig['defaultPopulate'],
  override: CollectionConfig['defaultPopulate'],
): CollectionConfig['defaultPopulate'] => {
  if (!base && !override) return undefined
  const merged = { ...(isRecord(base) ? base : {}), ...(isRecord(override) ? override : {}) }
  //EXCUSE: a merged select object for a runtime-configured collection; TS won't accept a plain {field: true} map as Payload's discriminated SelectType
  return merged as CollectionConfig['defaultPopulate']
}
