import 'server-only'

import type React from 'react'
import { draftMode } from 'next/headers'

import { getIconSvg, warnIconMissDev } from '../cache'
import { extractSvgContent, extractSvgProps } from '../lib/extractSVG'
import type { IconProps } from '../types'
import { trackIconMiss } from '../usage/trackIconMiss'

/**
 * Inline fallback rendered when `name` doesn't resolve. Kept local so the
 * component carries no extra dependency — pass {@link IconProps.fallback} to
 * override it with your own SVG string.
 */
const FALLBACK_WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10.7 10.7 106.6 106.6" fill="currentColor" stroke="currentColor"><path d="M64 37.3a5.3 5.3 0 015.3 5.4v26.6a5.3 5.3 0 11-10.6 0V42.7a5.3 5.3 0 015.3-5.4m0 53.4A5.3 5.3 0 0064 80a5.3 5.3 0 000 10.7"/><path fill-rule="evenodd" d="M10.7 64a53.3 53.3 0 11106.6 0 53.3 53.3 0 01-106.6 0M64 21.3a42.7 42.7 0 100 85.4 42.7 42.7 0 000-85.4"/></svg>`

/**
 * Renders a CMS-managed icon by name. Server component — looks up the active
 * `iconSet`, finds the entry matching `name`, and inlines its `<svg>` with the
 * source's intrinsic attributes (viewBox, fill, …) merged under any JSX props
 * you pass (so `className`, `style`, `width`, etc. always win). It inherits CSS
 * `color` via `currentColor`. Falls back to {@link IconProps.fallback} (or a
 * built-in warning glyph) when the name doesn't resolve.
 *
 * @example
 * ```tsx
 * import { Icon } from '@pro-laico/payload-icons/components/Icon'
 *
 * <Icon name="arrow-right" />
 * <Icon name="arrow-right" className="size-6 text-primary" />
 * <Icon name="logo" fallback={myCustomSvgString} />
 * ```
 */
/** The draft-mode lane, resolved safely from ANY scope. `draftMode()` is a request API that
 *  throws inside a `'use cache'` scope — where an inlined icon should read the published
 *  lane anyway (draft previews render dynamically, so the request path still resolves). */
const draftLane = async (): Promise<boolean> => {
  try {
    return (await draftMode()).isEnabled
  } catch {
    return false
  }
}

export const Icon = async ({ name, fallback, ...svgProps }: IconProps): Promise<React.ReactElement> => {
  const draft = await draftLane()
  const svg = await getIconSvg(name, draft)
  // Name didn't resolve against the active set — record it (throttled,
  // fire-and-forget) so the admin "Requested icons" panel can surface real
  // runtime misses, including dynamic names a static scan can't see.
  if (!svg) {
    trackIconMiss(name)
    void warnIconMissDev(name, draft) // dev-only, once per name — diagnoses WHY the name missed
  }
  const source = svg || fallback || FALLBACK_WARNING_SVG

  // Default to decorative (aria-hidden); callers announcing the icon override
  // with `aria-hidden={false}` + a title since svgProps wins over this default.
  // `data-icon-missing` marks fallback renders so multiple misses on a page are distinguishable.
  return (
    <svg
      aria-hidden="true"
      {...(svg ? {} : { 'data-icon-missing': name })}
      {...extractSvgProps(source)}
      {...svgProps}
      dangerouslySetInnerHTML={{ __html: extractSvgContent(source) }}
    />
  )
}

export default Icon
