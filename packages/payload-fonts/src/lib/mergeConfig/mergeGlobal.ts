import type { GlobalConfig } from 'payload'

import { mergeHooks } from './mergeHooks'

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
