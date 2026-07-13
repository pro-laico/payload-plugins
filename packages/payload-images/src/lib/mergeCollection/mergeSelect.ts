import type { CollectionConfig } from 'payload'

/** Shallow key-merge for the select-shaped configs, so an override adds keys without dropping the
 *  plugin's required ones. Returns undefined only when neither side has any. */
export const mergeSelect = (
  base: CollectionConfig['defaultPopulate'],
  override: CollectionConfig['defaultPopulate'],
): CollectionConfig['defaultPopulate'] =>
  base || override
    ? ({ ...(base as Record<string, unknown>), ...(override as Record<string, unknown> | undefined) } as CollectionConfig['defaultPopulate']) //EXCUSE: the generated per-collection select type doesn't exist inside the plugin
    : undefined
