import type { CollectionConfig, GlobalConfig } from 'payload'

/**
 * Additively merge two Payload hooks objects: each per-phase array in `extra` is
 * appended to the corresponding array in `base`. Phases present in only one of the
 * two are preserved as-is. User hooks always run AFTER base hooks within a phase.
 *
 * Vendored (with `mergeCollection` / `mergeGlobal` below) so this package carries no
 * dependency on a shared `core` utility package — it's ~40 lines and stable.
 */
export const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined>
  const e = extra as unknown as Record<string, unknown[] | undefined>
  const out: Record<string, unknown[]> = { ...b } as Record<string, unknown[]>
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T
}

/**
 * Deep-merge a partial override onto a base `CollectionConfig` without clobbering the
 * nested config a top-level spread would replace. Top-level keys replace, but:
 * - `access` / `admin` are shallow-merged (override keys win, base keys kept);
 * - `fields` are APPENDED (base fields first, then override fields);
 * - `upload` is shallow-merged when both sides are objects (so a partial
 *   `upload: { staticDir }` keeps the base `mimeTypes` whitelist);
 * - `hooks` are merged per-phase via {@link mergeHooks} (override hooks run after base).
 *
 * Returns `base` unchanged when `override` is undefined.
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

/**
 * Deep-merge a partial override onto a base `GlobalConfig`, mirroring {@link mergeCollection}
 * (globals have no `upload`). Returns `base` unchanged when `override` is undefined.
 */
export const mergeGlobal = (base: GlobalConfig, override?: Partial<GlobalConfig>): GlobalConfig =>
  override
    ? {
        ...base,
        ...override,
        access: { ...base.access, ...override.access },
        admin: { ...base.admin, ...override.admin },
        fields: [...base.fields, ...(override.fields ?? [])],
        hooks: override.hooks ? mergeHooks(base.hooks ?? {}, override.hooks) : base.hooks,
      }
    : base
