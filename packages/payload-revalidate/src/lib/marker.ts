import type { Payload, SanitizedConfig } from 'payload'

import { createTags } from './tags'
import type { PayloadRevalidateMarker, Tags } from '../types'

/**
 * The plugin's resolved state, read off a config that traveled with a live handle
 * (`req.payload.config`, or the instance the app passed a helper). `undefined` when the
 * plugin isn't applied to that config — callers degrade (unprefixed tags, no scope
 * policing) rather than guess.
 */
export const readRevalidateMarker = (config: SanitizedConfig): PayloadRevalidateMarker | undefined => {
  const marker = (config.custom as { payloadRevalidate?: PayloadRevalidateMarker } | undefined)?.payloadRevalidate
  return marker && typeof marker === 'object' ? marker : undefined
}

/** Tag builders honoring the app's plugin prefix, off a live handle — for hand-written
 *  `revalidateTag`/`cacheTag` calls outside the `./cache` helpers. */
export const tagsFor = (payload: Payload): Tags => createTags(readRevalidateMarker(payload.config)?.prefix)
