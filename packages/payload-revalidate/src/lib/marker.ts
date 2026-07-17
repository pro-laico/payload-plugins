import type { Payload, SanitizedConfig } from 'payload'

import { isRecord } from '../_kit'
import { createTags } from './tags'
import type { PayloadRevalidateMarker, Tags } from '../types'

/** For hand-built config sources (see MapConfigSource) where `custom` is genuinely unknown. */
export const isRevalidateMarker = (value: unknown): value is PayloadRevalidateMarker => isRecord(value)

export const readRevalidateMarker = (config: SanitizedConfig | undefined): PayloadRevalidateMarker | undefined =>
  config?.custom?.payloadRevalidate

export const tagsFor = (payload: Payload): Tags => createTags(readRevalidateMarker(payload.config)?.prefix)
