import type { RevalidateInspection } from '../types'

const INSPECT_SLOT = Symbol.for('pro-laico.payload-revalidate.inspect')

//EXCUSE: cross-package read channel — payload-dev-tools reads this Symbol.for slot without importing us; globalThis has no symbol index type and a named global would collide across two independently-typed packages
const slot = globalThis as Record<symbol, unknown>

export const stashInspect = (fn: () => RevalidateInspection): void => {
  slot[INSPECT_SLOT] = fn
}

export const getInspection = (): RevalidateInspection | null => {
  const fn = slot[INSPECT_SLOT]
  return typeof fn === 'function' ? fn() : null
}
