import type { CollectionConfig } from 'payload'

import type { Hooks } from '../types'

// Every collection hook phase. The `(keyof Hooks)[]` annotation validates each name at compile
// time, so a typo — or a phase Payload renames — is a build error, not a silent miss.
const HOOK_PHASES: (keyof Hooks)[] = [
  'afterChange',
  'afterDelete',
  'afterError',
  'afterForgotPassword',
  'afterLogin',
  'afterLogout',
  'afterMe',
  'afterOperation',
  'afterRead',
  'afterRefresh',
  'beforeChange',
  'beforeDelete',
  'beforeLogin',
  'beforeOperation',
  'beforeRead',
  'beforeValidate',
  'me',
  'refresh',
]

export const mergeHooks = (base: Hooks, extra?: CollectionConfig['hooks']): Hooks => {
  if (!extra) return base
  const out: Hooks = { ...base }
  for (const phase of HOOK_PHASES) {
    const merged = [...(base[phase] ?? []), ...(extra[phase] ?? [])]
    if (merged.length > 0) Object.assign(out, { [phase]: merged })
  }
  return out
}
