import type { RevalidateInspection } from '../types'

// Cross-package read channel — payload-dev-tools reads this Symbol.for slot without importing us;
// Reflect reads/writes globalThis by symbol without an untyped-global cast.
const INSPECT_SLOT = Symbol.for('pro-laico.payload-revalidate.inspect')

export const stashInspect = (fn: () => RevalidateInspection): void => {
  Reflect.set(globalThis, INSPECT_SLOT, fn)
}

export const getInspection = (): RevalidateInspection | null => {
  const fn = Reflect.get(globalThis, INSPECT_SLOT)
  return typeof fn === 'function' ? fn() : null
}
