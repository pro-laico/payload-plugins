import type { RevalidateEvent } from '../observe/observe'

/** One tag to bust plus WHY — the reason is what makes the dev map's event log legible. */
export interface Bust {
  tag: string
  reason: RevalidateEvent['busted'][number]['reason']
}
