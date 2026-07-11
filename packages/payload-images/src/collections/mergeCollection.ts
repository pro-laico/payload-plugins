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

/**
 * Deep-merge a partial override onto a base `CollectionConfig`. Top-level keys replace, but
 * `access`/`admin` shallow-merge, `fields` APPEND, `upload` shallow-merges when both are objects,
 * and `hooks` merge per-phase (override hooks run AFTER base hooks).
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
      }
    : base
