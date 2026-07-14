import type { Payload, SanitizedConfig } from 'payload'

import { createTags } from './tags'
import type { PayloadRevalidateMarker, Tags } from '../types'

export const readRevalidateMarker = (config: SanitizedConfig): PayloadRevalidateMarker | undefined => {
  //TODO: replace `as` cast with proper typing
  const marker = (config.custom as { payloadRevalidate?: PayloadRevalidateMarker } | undefined)?.payloadRevalidate
  return marker && typeof marker === 'object' ? marker : undefined
}

export const tagsFor = (payload: Payload): Tags => createTags(readRevalidateMarker(payload.config)?.prefix)
