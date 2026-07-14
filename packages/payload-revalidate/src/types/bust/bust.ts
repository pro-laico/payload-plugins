import type { RevalidateEvent } from '../observe/observe'

export interface Bust {
  tag: string
  reason: RevalidateEvent['busted'][number]['reason']
}
