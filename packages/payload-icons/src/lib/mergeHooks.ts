import type { CollectionConfig } from 'payload'

import type { Hooks } from '../types'

export const mergeHooks = (base: Hooks, extra?: CollectionConfig['hooks']): Hooks => {
  if (!extra) return base
  const out: Hooks = { ...base }
  for (const phase of Object.keys(extra) as Array<keyof Hooks>) {
    //TODO: replace `as` cast with proper typing
    const basePhase = (base[phase] ?? []) as unknown[] //TODO: replace `as` cast with proper typing
    const extraPhase = (extra[phase] ?? []) as unknown[] //TODO: replace `as` cast with proper typing
    out[phase] = [...basePhase, ...extraPhase] as never //TODO: replace `as` cast with proper typing
  }
  return out
}
