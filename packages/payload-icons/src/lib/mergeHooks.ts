import type { CollectionConfig } from 'payload'

import type { Hooks } from '../types'

/** Append the user's collection hooks AFTER the built-ins, per phase. The built-ins always run
 *  first, so a user `beforeChange` hook sees the already-optimized SVG. Phases with no built-in
 *  just carry the user's hooks. */
export const mergeHooks = (base: Hooks, extra?: CollectionConfig['hooks']): Hooks => {
  if (!extra) return base
  const out: Hooks = { ...base }
  for (const phase of Object.keys(extra) as Array<keyof Hooks>) {
    const basePhase = (base[phase] ?? []) as unknown[]
    const extraPhase = (extra[phase] ?? []) as unknown[]
    out[phase] = [...basePhase, ...extraPhase] as never
  }
  return out
}
