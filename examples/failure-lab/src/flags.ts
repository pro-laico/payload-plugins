/** Mutable failure switches. Hooks in the config check these, so a test can flip a switch to make a
 *  specific write fail deterministically — no adapter-specific constraint gymnastics required. */
export const flags = {
  /** `media.beforeDelete` throws — an un-deletable doc, so `clearCollection`'s warn path fires. */
  lockMediaDeletes: false,
  /** `things.beforeChange` throws on update — fails the deferred-field second pass. */
  failThingUpdates: false,
}

export function resetFlags(): void {
  flags.lockMediaDeletes = false
  flags.failThingUpdates = false
}
