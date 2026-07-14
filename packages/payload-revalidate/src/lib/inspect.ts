import type { RevalidateInspection } from '../types'

const INSPECT_SLOT = Symbol.for('pro-laico.payload-revalidate.inspect')

export const stashInspect = (fn: () => RevalidateInspection): void => {
  ;(globalThis as Record<symbol, unknown>)[INSPECT_SLOT] = fn //TODO: replace `as` cast with proper typing
}

export const getInspection = (): RevalidateInspection | null => {
  //TODO: replace `as` casts with proper typing
  const fn = (globalThis as Record<symbol, unknown>)[INSPECT_SLOT] as (() => RevalidateInspection) | undefined
  return fn ? fn() : null
}
