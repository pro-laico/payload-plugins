import type React from 'react'

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: string
  fallback?: string
  /** Read the draft lane instead of the published one. Default `false`. Pass
   * `(await draftMode()).isEnabled` from a preview route; leaving it alone keeps the page
   * prerenderable, since nothing here touches a request API. */
  draft?: boolean
}
