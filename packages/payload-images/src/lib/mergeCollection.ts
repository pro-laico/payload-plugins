import type { CollectionConfig } from 'payload'

/**
 * Additively merge two Payload hooks objects: each per-phase array in `extra` is
 * appended to the corresponding array in `base`. Phases present in only one of the two
 * are preserved as-is. User hooks always run AFTER base hooks within each phase.
 */
const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b = base as unknown as Record<string, unknown[] | undefined>
  const e = extra as unknown as Record<string, unknown[] | undefined>
  const out: Record<string, unknown[]> = { ...b } as Record<string, unknown[]>
  for (const key of Object.keys(e)) out[key] = [...(b[key] ?? []), ...(e[key] ?? [])]
  return out as unknown as T
}

/**
 * Deep-merge a partial override onto a base `CollectionConfig` without clobbering the
 * nested config a top-level spread would otherwise replace.
 *
 * Top-level keys replace, but:
 * - `access` / `admin` are shallow-merged (override keys win, base keys kept).
 * - `fields` are APPENDED (base fields first, then override fields).
 * - `upload` is shallow-merged when both sides are objects (so a partial
 *   `upload: { staticDir }` keeps the base `mimeTypes` whitelist).
 * - `hooks` are merged per-phase via {@link mergeHooks} (override hooks run AFTER the
 *   base hooks within each phase).
 *
 * When `override` is undefined, `base` is returned unchanged.
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
