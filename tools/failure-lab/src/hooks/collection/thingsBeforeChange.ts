/**
 * beforeChange on `things` → when `flags.failThingUpdates` is set, every UPDATE throws, failing the
 * deferred-field second pass. Creates pass through untouched.
 */
import type { CollectionBeforeChangeHook } from 'payload'

import { flags } from '../../flags'

export const failThingUpdatesBeforeChange: CollectionBeforeChangeHook = ({ operation, data }) => {
  if (flags.failThingUpdates && operation === 'update') throw new Error('simulated: things are locked after create')
  return data
}
