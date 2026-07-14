import type React from 'react'
import type { Payload } from 'payload'
import { draftMode } from 'next/headers'

import type { IconProps } from '../types'
import { trackIconMiss } from '../usage/trackIconMiss'
import { getIconSvg, warnIconMissDev } from '../cache'
import { extractSvgContent, extractSvgProps } from '../lib/extractSVG'

import 'server-only'

const FALLBACK_WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10.7 10.7 106.6 106.6" fill="currentColor" stroke="currentColor"><path d="M64 37.3a5.3 5.3 0 015.3 5.4v26.6a5.3 5.3 0 11-10.6 0V42.7a5.3 5.3 0 015.3-5.4m0 53.4A5.3 5.3 0 0064 80a5.3 5.3 0 000 10.7"/><path fill-rule="evenodd" d="M10.7 64a53.3 53.3 0 11106.6 0 53.3 53.3 0 01-106.6 0M64 21.3a42.7 42.7 0 100 85.4 42.7 42.7 0 000-85.4"/></svg>`

const draftLane = async (): Promise<boolean> => {
  try {
    return (await draftMode()).isEnabled
  } catch {
    return false
  }
}

export const createIcon = (payload: Payload | Promise<Payload>): ((props: IconProps) => Promise<React.ReactElement>) => {
  return async function Icon({ name, fallback, ...svgProps }: IconProps): Promise<React.ReactElement> {
    const draft = await draftLane()
    const svg = await getIconSvg(payload, name, draft)
    if (!svg) {
      trackIconMiss(payload, name)
      void warnIconMissDev(payload, name, draft)
    }
    const source = svg || fallback || FALLBACK_WARNING_SVG

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
}

export default createIcon
