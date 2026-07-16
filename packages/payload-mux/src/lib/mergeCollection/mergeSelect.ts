import type { CollectionConfig, SelectIncludeType } from 'payload'

import { isRecord } from '../isRecord'

// The plugin's selects are include-mode ({ field: true }); Object.assign merges them into a typed
// accumulator without a cast (it doesn't re-check each copied value against SelectIncludeType).
export const mergeSelect = (
  base: CollectionConfig['forceSelect'],
  override: CollectionConfig['forceSelect'],
): SelectIncludeType | undefined => {
  if (!base && !override) return undefined
  const out: SelectIncludeType = {}
  if (isRecord(base)) Object.assign(out, base)
  if (isRecord(override)) Object.assign(out, override)
  return out
}
