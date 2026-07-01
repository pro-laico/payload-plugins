/**
 * Generate the inline LQIP for `<ResponsiveImage>`: a tiny, faithful (per aspect-ratio +
 * focal point) variant resolved to a base64 `data:` URI, server-side. Shares the one
 * `generated-images` cache via {@link getOrCreateVariantBytes}, so the LQIP for a given
 * (id, ar, focal) is built once ever — by whichever door (this, or the `/api/img` endpoint)
 * asks first.
 *
 * Server-only (pulls in `getPayload` + Sharp). `<ResponsiveImage>` imports it **dynamically**,
 * only when a placeholder is actually needed, so the lightweight render path never bundles it.
 */
import { getPayload, type Payload, type SanitizedConfig } from 'payload'

import { getServerSideURL } from '../lib/getServerSideURL'
import { getOrCreateVariantBytes, type VariantSourceDoc } from '../transform/getVariantBytes'
import { clampLqipQuality, resolveLqipWidth } from '../transform/lqip'
import type { Fit, ParsedParams } from '../transform/params'

interface PayloadImagesStash {
  sourceSlug?: string
  variantSlug?: string
  maxInputPixels?: number
  placeholder?: false | { width: number; quality: number; format: 'webp' | 'jpeg'; maxWidth: number }
}

export interface InlineLqipArgs {
  /** The resolved Payload config (already in hand from `<ResponsiveImage>` / `req.payload.config`). */
  config: SanitizedConfig
  /** Populated source doc — needs `filename`/`url` + focal point. */
  source: VariantSourceDoc
  /** Render aspect ratio; omitted = the source's natural ratio. */
  ar?: number
  fit: Fit
  /** Per-read width override (else the project default). Clamped per `untrusted`. */
  width?: number
  /** Per-read quality override (else the project default). Clamped to 20–70. */
  quality?: number
  /**
   * Untrusted caller (the external `context.lqip` / `X-LQIP` door): clamp width to `maxWidth` and
   * snap to /8. The trusted component path leaves this false and its width is honored up to a guard.
   */
  untrusted?: boolean
  /** Reuse an existing Payload instance (e.g. `req.payload` in a hook); otherwise `getPayload(config)`. */
  payload?: Payload
}

/** Returns a `data:` URI for the LQIP, or `undefined` when disabled / not generatable (caller renders no placeholder). */
export const generateInlineLqip = async ({
  config,
  source,
  ar,
  fit,
  width,
  quality,
  untrusted = false,
  payload: existing,
}: InlineLqipArgs): Promise<string | undefined> => {
  try {
    const stash = (config as { custom?: { payloadImages?: PayloadImagesStash } }).custom?.payloadImages
    const ph = stash?.placeholder
    if (!ph) return undefined // disabled project-wide

    const payload = existing ?? (await getPayload({ config }))
    const sourceSlug = stash?.sourceSlug ?? 'images'
    const variantSlug = stash?.variantSlug ?? 'generated-images'
    const maxInputPixels = stash?.maxInputPixels ?? 100_000_000
    const base = config.serverURL || getServerSideURL() || ''

    const w = resolveLqipWidth(width, ph.width, ph.maxWidth, untrusted)
    const q = clampLqipQuality(quality, ph.quality)
    const h = ar ? Math.max(1, Math.round(w / ar)) : undefined
    const params: ParsedParams = { w, h, fit, q, fmt: ph.format }

    const res = await getOrCreateVariantBytes({ payload, source, params, format: ph.format, sourceSlug, variantSlug, base, maxInputPixels })
    if (!res.ok) return undefined
    return `data:image/${ph.format};base64,${res.data.toString('base64')}`
  } catch {
    return undefined
  }
}
