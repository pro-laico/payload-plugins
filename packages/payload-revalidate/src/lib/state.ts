import type { RevalidateState } from '../types'

/** The globalThis slot the plugin factory fills when the config is built. `Symbol.for` →
 *  one shared registry entry, so `./cache` and the hooks read the same stash in any
 *  process that loaded the config. */
const STATE_SLOT = Symbol.for('pro-laico.payload-revalidate.state')

/** Called from the plugin factory (config-build time): remember the resolved tag prefix. */
export const stashState = (state: RevalidateState): void => {
  ;(globalThis as Record<symbol, unknown>)[STATE_SLOT] = state
}

/** The stashed plugin state; defaults when the plugin never ran (e.g. unit tests). */
export const getState = (): RevalidateState =>
  ((globalThis as Record<symbol, unknown>)[STATE_SLOT] as RevalidateState | undefined) ?? {
    prefix: '',
    observe: process.env.NODE_ENV === 'development',
  }
