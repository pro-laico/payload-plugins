import type { CollectionConfig } from 'payload'

/** Append each per-phase hook array in `extra` after the corresponding `base` array. */
const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined> //EXCUSE: Payload's hooks object is iterated generically; arrays are recombined per key
  const e = extra as unknown as Record<string, unknown[] | undefined> //EXCUSE: same as above
  const out: Record<string, unknown[] | undefined> = { ...b }
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T //EXCUSE: reverse of the generic widening above
}

/** Shallow key-merge for the select-shaped configs, so an override adds keys without dropping the
 *  plugin's required ones. Returns undefined only when neither side has any. */
const mergeSelect = (
  base: CollectionConfig['defaultPopulate'],
  override: CollectionConfig['defaultPopulate'],
): CollectionConfig['defaultPopulate'] =>
  base || override
    ? ({ ...(base as Record<string, unknown>), ...(override as Record<string, unknown> | undefined) } as CollectionConfig['defaultPopulate']) //EXCUSE: the generated per-collection select type doesn't exist inside the plugin
    : undefined

/**
 * Deep-merge a partial override onto a base `CollectionConfig`. Top-level keys replace, but
 * `access`/`admin` shallow-merge, `fields` APPEND, `upload` shallow-merges when both are objects,
 * `hooks` merge per-phase (override after base), and `defaultPopulate`/`forceSelect` key-merge so
 * a user override can add fields but never drops the plugin's virtual-field inputs (which would
 * null out `src`/`srcset`/`placeholder` on every populated read).
 */
export const mergeCollection = (base: CollectionConfig, override?: Partial<CollectionConfig>): CollectionConfig =>
  override
    ? {
        ...base,
        ...override,
        access: { ...base.access, ...override.access },
        admin: { ...base.admin, ...override.admin },
        fields: [...base.fields, ...(override.fields ?? [])],
        upload:
          override.upload && typeof override.upload === 'object' && typeof base.upload === 'object'
            ? { ...base.upload, ...override.upload }
            : (override.upload ?? base.upload),
        hooks: override.hooks ? mergeHooks(base.hooks ?? {}, override.hooks) : base.hooks,
        ...(base.defaultPopulate || override.defaultPopulate
          ? { defaultPopulate: mergeSelect(base.defaultPopulate, override.defaultPopulate) }
          : {}),
        ...(base.forceSelect || override.forceSelect
          ? {
              forceSelect: mergeSelect(
                base.forceSelect as CollectionConfig['defaultPopulate'],
                override.forceSelect as CollectionConfig['defaultPopulate'],
              ) as CollectionConfig['forceSelect'],
            } //EXCUSE: forceSelect and defaultPopulate share the select shape the generated types don't expose here
          : {}),
      }
    : base
