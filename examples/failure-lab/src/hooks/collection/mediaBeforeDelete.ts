/**
 * beforeDelete on `media` → when `flags.lockMediaDeletes` is set, every delete throws, leaving an
 * un-clearable doc so `clearCollection`'s warn path (with the doc's human label) can be observed.
 */
import type { CollectionBeforeDeleteHook } from 'payload'

import { flags } from '../../flags'

export const lockMediaDeletesBeforeDelete: CollectionBeforeDeleteHook = () => {
  if (flags.lockMediaDeletes) throw new Error('simulated storage outage: delete rejected')
}
