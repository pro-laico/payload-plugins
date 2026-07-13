import type { CollectionConfig } from 'payload'

import { mergeHooks } from './mergeHooks'

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
