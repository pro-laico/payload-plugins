import type { CollectionConfig } from 'payload'

import { mergeHooks } from './mergeHooks'
import { mergeSelect } from './mergeSelect'

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
                base.forceSelect as CollectionConfig['defaultPopulate'], //TODO: replace `as` cast with proper typing
                override.forceSelect as CollectionConfig['defaultPopulate'], //TODO: replace `as` cast with proper typing
              ) as CollectionConfig['forceSelect'], //TODO: replace `as` cast with proper typing
            }
          : {}),
      }
    : base
