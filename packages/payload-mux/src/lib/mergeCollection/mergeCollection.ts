import type { CollectionConfig } from 'payload'

import { mergeHooks } from './mergeHooks'
import { mergeSelect } from './mergeSelect'

export const mergeCollection = (base: CollectionConfig, override?: Partial<CollectionConfig>): CollectionConfig =>
  override
    ? {
        ...base,
        ...override,
        // A slug override would desync every internal reference (the webhook's collection lookup,
        // the uploader field, seeding), so the base slug always wins. (The option types Omit 'slug'
        // too — `extendCollection` is how you put the Mux fields on a collection of your own.)
        slug: base.slug,
        access: { ...base.access, ...override.access },
        admin: { ...base.admin, ...override.admin },
        custom: { ...base.custom, ...override.custom },
        fields: [...base.fields, ...(override.fields ?? [])],
        upload:
          override.upload && typeof override.upload === 'object' && typeof base.upload === 'object'
            ? { ...base.upload, ...override.upload }
            : (override.upload ?? base.upload),
        hooks: override.hooks ? mergeHooks(base.hooks ?? {}, override.hooks) : base.hooks,
        ...(base.forceSelect || override.forceSelect ? { forceSelect: mergeSelect(base.forceSelect, override.forceSelect) } : {}),
      }
    : base
