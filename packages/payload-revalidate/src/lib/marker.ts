import type { Payload, SanitizedConfig } from 'payload'

import { isRecord } from './isRecord'
import { createTags } from './tags'
import type { PayloadRevalidateMarker, Tags } from '../types'

export const isRevalidateMarker = (value: unknown): value is PayloadRevalidateMarker => isRecord(value)

export const readRevalidateMarker = (config: SanitizedConfig): PayloadRevalidateMarker | undefined => {
  const marker = config.custom?.payloadRevalidate
  return isRevalidateMarker(marker) ? marker : undefined
}

export const tagsFor = (payload: Payload): Tags => createTags(readRevalidateMarker(payload.config)?.prefix)
