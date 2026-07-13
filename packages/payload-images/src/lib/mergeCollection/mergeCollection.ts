import type { CollectionConfig } from 'payload'

import { mergeHooks } from './mergeHooks'
import { mergeSelect } from './mergeSelect'

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
